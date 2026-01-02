#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
COMPTAFLOW - Module Mistral AI Parser
Extraction de transactions bancaires via LLM (RGPD compliant - serveurs EU)
"""

from mistralai import Mistral
import os
import json
import re
import logging
from typing import List, Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Mode debug (activer avec DEBUG_MISTRAL=True dans .env)
DEBUG_MODE = os.getenv("DEBUG_MISTRAL", "False").lower() == "true"


def extract_with_mistral(text: str, bank_type: Optional[str] = None, debug: bool = False) -> List[Dict]:
    """
    Extrait les transactions d'un relevé bancaire via Mistral AI
    
    Args:
        text: Texte extrait du relevé bancaire
        bank_type: Type de banque détecté (optionnel, pour contexte)
        debug: Si True, affiche des logs détaillés pour le debugging
    
    Returns:
        Liste des transactions au format standardisé
    """
    # Activer le debug si demandé ou si DEBUG_MODE global
    debug = debug or DEBUG_MODE
    
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        logger.error("MISTRAL_API_KEY non configurée")
        raise Exception("Clé API Mistral manquante")
    
    # 🔍 DEBUG: Afficher le texte extrait du PDF
    if debug:
        logger.info("="*80)
        logger.info("🔍 DEBUG - TEXTE EXTRAIT DU PDF:")
        logger.info("="*80)
        logger.info(text[:2000])  # Premiers 2000 caractères
        logger.info(f"... (total: {len(text)} caractères)")
        logger.info("="*80)
    
    # Limiter le texte pour éviter dépassement tokens
    text_limited = text[:8000] if len(text) > 8000 else text
    
    if debug and len(text) > 8000:
        logger.warning(f"⚠️ Texte tronqué: {len(text)} → 8000 caractères")
    
    # Construire le prompt optimisé
    bank_context = f" (banque détectée: {bank_type})" if bank_type else ""
    
    prompt = f"""Tu es un expert en extraction de données bancaires françaises.
Analyse ce relevé bancaire{bank_context} et extrait TOUTES les transactions visibles au format JSON strict.

Relevé bancaire:
{text_limited}

Format JSON attendu (IMPORTANT - respecter exactement ce format):
[
  {{"date": "30/10/2025", "libelle": "CERTAS ESSOF024", "montant": -16.62}},
  {{"date": "31/10/2025", "libelle": "CAFE FRANCIS", "montant": -23.40}},
  {{"date": "01/11/2025", "libelle": "VIREMENT SALAIRE", "montant": 2500.00}}
]

Règles strictes:
1. Date: format JJ/MM/AAAA (ex: 30/10/2025)
2. Montant: 
   - NÉGATIF pour débits/achats (ex: -16.62)
   - POSITIF pour crédits/virements reçus (ex: 2500.00)
   - Format décimal avec point (ex: 16.62, pas 16,62)
3. Libellé: nom du commerce/opération (sans la date)
4. Extraire TOUTES les transactions (débits ET crédits)
5. Retourner UNIQUEMENT le tableau JSON, aucun texte avant/après
6. Si une ligne contient "CREDIT" ou "VIREMENT RECU", le montant est POSITIF

JSON (sans markdown, sans explications):"""

    try:
        logger.info("📡 Appel Mistral AI pour extraction...")
        client = Mistral(api_key=api_key)
        
        response = client.chat.complete(
            model="mistral-small-latest",  # Optimal: rapide, précis, pas cher
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,  # Basse température pour plus de précision
            max_tokens=4000
        )
        
        json_text = response.choices[0].message.content.strip()
        logger.info(f"✅ Réponse Mistral reçue ({len(json_text)} caractères)")
        
        # 🔍 DEBUG: Afficher la réponse COMPLÈTE de Mistral
        if debug:
            logger.info("="*80)
            logger.info("🔍 DEBUG - RÉPONSE COMPLÈTE DE MISTRAL:")
            logger.info("="*80)
            logger.info(json_text)
            logger.info("="*80)
        else:
            logger.debug(f"Réponse brute: {json_text[:500]}")
        
        # Nettoyer la réponse (enlever markdown si présent)
        json_text_cleaned = json_text.replace("```json", "").replace("```", "").strip()
        
        # Extraire le tableau JSON
        match = re.search(r'\[.*\]', json_text_cleaned, re.DOTALL)
        if not match:
            logger.error("❌ Pas de JSON trouvé dans la réponse Mistral")
            if not debug:  # Afficher la réponse en cas d'erreur même sans debug
                logger.error(f"Réponse complète: {json_text}")
            return []
        
        transactions_raw = json.loads(match.group(0))
        
        if debug:
            logger.info(f"📊 {len(transactions_raw)} transactions brutes trouvées")
        
        # Valider et nettoyer les transactions
        transactions = []
        rejected_count = 0
        
        for idx, t in enumerate(transactions_raw):
            try:
                # Vérifier les champs requis
                if not all(k in t for k in ["date", "libelle", "montant"]):
                    missing_fields = [k for k in ["date", "libelle", "montant"] if k not in t]
                    rejected_count += 1
                    if debug:
                        logger.warning(f"❌ Transaction #{idx+1} rejetée: champs manquants {missing_fields}")
                        logger.warning(f"   Contenu: {t}")
                    continue
                
                # Valider et normaliser le format de date
                date_normalized = _normalize_date(t["date"])
                if not date_normalized:
                    rejected_count += 1
                    if debug:
                        logger.warning(f"❌ Transaction #{idx+1} rejetée: date invalide '{t['date']}'")
                        logger.warning(f"   Contenu: {t}")
                    continue
                
                # Convertir le montant en float
                montant = float(t["montant"])
                
                transaction = {
                    "Date": date_normalized,
                    "Libellé": t["libelle"].strip(),
                    "Montant": montant
                }
                transactions.append(transaction)
                
                if debug:
                    logger.info(f"✅ Transaction #{idx+1} validée: {date_normalized} | {t['libelle'][:30]} | {montant}€")
                
            except ValueError as e:
                rejected_count += 1
                if debug:
                    logger.warning(f"❌ Transaction #{idx+1} rejetée: montant invalide '{t.get('montant')}'")
                    logger.warning(f"   Erreur: {str(e)}")
                    logger.warning(f"   Contenu: {t}")
            except Exception as e:
                rejected_count += 1
                if debug:
                    logger.warning(f"❌ Transaction #{idx+1} rejetée: {str(e)}")
                    logger.warning(f"   Contenu: {t}")
                continue
        
        # 🔍 DEBUG: Résumé final
        if debug:
            logger.info("="*80)
            logger.info(f"📊 RÉSUMÉ FINAL:")
            logger.info(f"   ✅ Transactions validées: {len(transactions)}")
            logger.info(f"   ❌ Transactions rejetées: {rejected_count}")
            logger.info(f"   📄 Total brut: {len(transactions_raw)}")
            logger.info("="*80)
        else:
            logger.info(f"✅ Mistral AI: {len(transactions)} transactions extraites et validées")
        
        return transactions
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ Erreur parsing JSON: {str(e)}")
        logger.error(f"Texte reçu: {json_text_cleaned[:1000]}")
        return []
    except Exception as e:
        logger.error(f"❌ Erreur Mistral AI: {str(e)}")
        if debug:
            import traceback
            logger.error(traceback.format_exc())
        return []


def _normalize_date(date_str: str) -> Optional[str]:
    """
    Normalise une date au format JJ/MM/AAAA
    Accepte: JJ/MM/AAAA, JJMMAAAA, JJ-MM-AAAA
    
    Returns:
        Date normalisée au format JJ/MM/AAAA ou None si invalide
    """
    try:
        # Enlever les espaces
        date_str = str(date_str).strip()
        
        # Format JJ/MM/AAAA (déjà normalisé)
        if re.match(r'^\d{2}/\d{2}/\d{4}$', date_str):
            datetime.strptime(date_str, "%d/%m/%Y")  # Valider
            return date_str
        
        # Format JJMMAAAA
        if re.match(r'^\d{8}$', date_str):
            day = date_str[:2]
            month = date_str[2:4]
            year = date_str[4:]
            date_normalized = f"{day}/{month}/{year}"
            datetime.strptime(date_normalized, "%d/%m/%Y")  # Valider
            return date_normalized
        
        # Format JJ-MM-AAAA
        if re.match(r'^\d{2}-\d{2}-\d{4}$', date_str):
            date_normalized = date_str.replace('-', '/')
            datetime.strptime(date_normalized, "%d/%m/%Y")  # Valider
            return date_normalized
        
        logger.debug(f"Format de date non reconnu: {date_str}")
        return None
        
    except ValueError as e:
        logger.debug(f"Date invalide: {date_str} - {str(e)}")
        return None


def extract_with_mistral_detailed(text: str, bank_type: Optional[str] = None, debug: bool = False) -> Dict:
    """
    Version détaillée retournant plus d'informations
    Utile pour le debug et les statistiques
    
    Returns:
        Dict avec transactions, count, method, bank_type, success, text_length
    """
    transactions = extract_with_mistral(text, bank_type, debug=debug)
    
    return {
        "transactions": transactions,
        "count": len(transactions),
        "method": "mistral-ai",
        "bank_type": bank_type or "unknown",
        "success": len(transactions) > 0,
        "text_length": len(text),
        "text_preview": text[:500] if not debug else None  # Aperçu si pas en mode debug
    }


# Fonction de test (optionnelle)
def test_mistral_parser():
    """Test basique du parser Mistral"""
    test_text = """
    RELEVE DE COMPTE - CRÉDIT MUTUEL
    Date       Libellé                 Montant
    30/10/2025 CERTAS ESSOF024        -16,62 EUR
    31/10/2025 CAFE FRANCIS           -23,40 EUR
    01/11/2025 VIREMENT SALAIRE      +2500,00 EUR
    02/11/2025 AMAZON EU             -45,99 EUR
    """
    
    print("\n" + "="*80)
    print("🧪 TEST DU PARSER MISTRAL (MODE DEBUG)")
    print("="*80)
    
    result = extract_with_mistral_detailed(test_text, "Crédit Mutuel", debug=True)
    
    print("\n" + "="*80)
    print("📊 RÉSULTAT FINAL:")
    print("="*80)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    # Configuration du logging pour les tests
    logging.basicConfig(
        level=logging.DEBUG,  # DEBUG pour voir tous les logs
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    test_mistral_parser()
