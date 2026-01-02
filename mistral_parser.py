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

logger = logging.getLogger(__name__)


def extract_with_mistral(text: str, bank_type: Optional[str] = None) -> List[Dict]:
    """
    Extrait les transactions d'un relevé bancaire via Mistral AI
    
    Args:
        text: Texte extrait du relevé bancaire
        bank_type: Type de banque détecté (optionnel, pour contexte)
    
    Returns:
        Liste des transactions au format standardisé
    """
    
    api_key = os.getenv("MISTRAL_API_KEY")
    
    if not api_key:
        logger.error("❌ MISTRAL_API_KEY non configurée")
        raise Exception("Clé API Mistral manquante")
    
    # Limiter le texte pour éviter dépassement tokens
    text_limited = text[:6000] if len(text) > 6000 else text
    
    # Construire le prompt optimisé
    bank_context = f"\nBanque détectée: {bank_type}" if bank_type else ""
    
    prompt = f"""Tu es un expert en extraction de données bancaires françaises.

Analyse ce relevé bancaire et extrait TOUTES les transactions visibles au format JSON strict.{bank_context}

Relevé bancaire:
{text_limited}

Format JSON attendu (IMPORTANT - respecter exactement ce format):
[
  {{"date": "30/10/2025", "libelle": "CERTAS ESSOF024", "montant": -16.62}},
  {{"date": "31/10/2025", "libelle": "CAFE FRANCIS", "montant": -23.40}},
  {{"date": "01/11/2025", "libelle": "VIREMENT SALAIRE", "montant": 2500.00}}
]

Règles strictes:
1. Date: format JJ/MM/YYYY (ex: 30/10/2025)
2. Montant: 
   - NÉGATIF pour débits/achats (ex: -16.62)
   - POSITIF pour crédits/virements reçus (ex: 2500.00)
   - Format décimal avec point (ex: 16.62, pas 16,62)
3. Libellé: nom du commerce/opération sans la date
4. Extraire TOUTES les transactions (débits ET crédits)
5. Retourner UNIQUEMENT le tableau JSON, aucun texte avant/après
6. Si une ligne contient "CREDIT" ou "VIREMENT RECU", le montant est POSITIF

JSON (sans markdown, sans explications):"""

    try:
        logger.info("🤖 Appel à Mistral AI pour extraction...")
        
        client = Mistral(api_key=api_key)
        
        response = client.chat.complete(
            model="mistral-small-latest",  # Optimal: rapide + précis + pas cher
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.1,  # Basse température pour plus de précision
            max_tokens=3000
        )
        
        json_text = response.choices[0].message.content.strip()
        
        logger.info(f"📝 Réponse Mistral reçue: {len(json_text)} caractères")
        logger.debug(f"Réponse brute: {json_text[:500]}")
        
        # Nettoyer la réponse (enlever markdown si présent)
        json_text = json_text.replace('```json', '').replace('```', '').strip()
        
        # Extraire le tableau JSON
        match = re.search(r'\[.*\]', json_text, re.DOTALL)
        
        if not match:
            logger.error("❌ Pas de JSON trouvé dans la réponse Mistral")
            logger.error(f"Réponse complète: {json_text}")
            return []
        
        transactions_raw = json.loads(match.group(0))
        
        # Valider et nettoyer les transactions
        transactions = []
        for t in transactions_raw:
            try:
                # Vérifier les champs requis
                if not all(k in t for k in ['date', 'libelle', 'montant']):
                    logger.warning(f"⚠️ Transaction invalide (champs manquants): {t}")
                    continue
                
                # Valider le format de date
                date_pattern = r'^\d{2}/\d{2}/\d{4}$'
                if not re.match(date_pattern, t['date']):
                    logger.warning(f"⚠️ Date invalide: {t['date']}")
                    continue
                
                # Convertir le montant en float si nécessaire
                montant = float(t['montant'])
                
                transactions.append({
                    'Date': t['date'],
                    'Libellé': t['libelle'].strip(),
                    'Montant': montant
                })
                
            except Exception as e:
                logger.warning(f"⚠️ Erreur validation transaction: {str(e)} - {t}")
                continue
        
        logger.info(f"✅ Mistral AI: {len(transactions)} transactions extraites et validées")
        
        return transactions
    
    except json.JSONDecodeError as e:
        logger.error(f"❌ Erreur parsing JSON: {str(e)}")
        logger.error(f"Texte reçu: {json_text[:500]}")
        return []
    
    except Exception as e:
        logger.error(f"❌ Erreur Mistral AI: {str(e)}")
        return []


def extract_with_mistral_detailed(text: str, bank_type: Optional[str] = None) -> Dict:
    """
    Version détaillée retournant plus d'informations
    Utile pour le debug
    """
    transactions = extract_with_mistral(text, bank_type)
    
    return {
        'transactions': transactions,
        'count': len(transactions),
        'method': 'mistral-ai',
        'bank_type': bank_type or 'unknown',
        'success': len(transactions) > 0
    }
