#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COMPTAFLOW - Module de Parsing Bancaire
VERSION AVEC LOGS DÉTAILLÉS POUR DEBUG
"""

import pdfplumber
import pandas as pd
import re
import io
import logging
from typing import List, Dict, Tuple
from fastapi import HTTPException
from ocr_utils import extract_text_smart
from mistral_parser import extract_with_mistral

# Utilisez:
logger = logging.getLogger('parsers')

# Et juste après, configurez-le explicitement
logger.setLevel(logging.INFO)


# ============================================================================
# FONCTION DE DEBUG
# ============================================================================

def debug_pdf_content(pdf_bytes: bytes, num_lines: int = 50):
    """
    Affiche les N premières lignes du PDF pour debug
    """
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        with pdfplumber.open(pdf_file) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text()
        
        lines = text.split('\n')
        logger.info("=" * 80)
        logger.info(f"📄 CONTENU DU PDF (premières {num_lines} lignes)")
        logger.info("=" * 80)
        for i, line in enumerate(lines[:num_lines]):
            logger.info(f"[{i:3d}] {line}")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"Erreur debug PDF: {str(e)}")


# ============================================================================
# EXTRACTION PDF
# ============================================================================

def extract_text_from_pdf(file_content: bytes) -> str:
    """
    Extrait le texte d'un fichier PDF avec pdfplumber (plus robuste que PyPDF2)
    """
    try:
        import io
        import pdfplumber
        
        pdf_file = io.BytesIO(file_content)
        text = ""
        
        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        
        return text
    except Exception as e:
        raise HTTPException(
            status_code=400, 
            detail=f"Erreur lors de la lecture du PDF: {str(e)}"
        )


# ============================================================================
# DÉTECTION BANQUE
# ============================================================================

def detect_bank_format(text: str) -> str:
    """Détecte le format bancaire"""
    text_upper = text.upper()
    
    if "CREDIT AGRICOLE" in text_upper:
        return "CA"
    elif "BANQUE POPULAIRE" in text_upper:
        return "BP"
    elif "CREDIT LYONNAIS" in text_upper or "LCL" in text_upper:
        return "LCL"
    elif "SOCIETE GENERALE" in text_upper or "SOCIÉTÉ GÉNÉRALE" in text_upper:
        return "SG"
    elif "BNP" in text_upper:
        return "BNP"
    else:
        return "UNKNOWN"


# ============================================================================
# PARSERS BANCAIRES
# ============================================================================

def extract_ca_transactions(lines: List[str]) -> List[Dict]:
    """Format Crédit Agricole: JJ.MM COMMERCE LIEU MONTANT"""
    transactions = []
    skip_keywords = ['TOTAL', 'Date', 'Montant', 'Commerce', 'Page']
    
    for line in lines:
        if any(skip in line for skip in skip_keywords):
            continue
        
        date_match = re.search(r'(\d{1,2}\.\d{2})', line)
        montant_match = re.search(r'-?(\d{1,5}),(\d{2})', line)
        
        if date_match and montant_match:
            try:
                date_str = date_match.group(1)
                montant_str = montant_match.group(1)
                
                start_idx = date_match.end()
                end_idx = montant_match.start()
                middle_text = line[start_idx:end_idx].strip()
                
                if not middle_text:
                    continue
                
                jour, mois = date_str.split('.')
                date_format = f"{jour}/{mois}/2025"
                montant = float(montant_str.replace(',', '.'))
                
                transactions.append({
                    'Date': date_format,
                    'Libellé': middle_text,
                    'Montant': -montant
                })
            except:
                pass
    
    return transactions


def extract_bp_transactions(lines: List[str]) -> List[Dict]:
    """Format Banque Populaire: JJMMYY COMMERCE ADRESSE MONTANT"""
    transactions = []
    skip_keywords = ['DATE', 'NOM', 'MONTANT', 'Page', 'TOTAL']
    
    for line in lines:
        if any(skip in line for skip in skip_keywords):
            continue
        
        date_match = re.match(r'(\d{1,2})(\d{2})(\d{2})', line.strip())
        montant_match = re.search(r'(\d+),(\d{2})', line.strip())
        
        if date_match and montant_match:
            try:
                jour = date_match.group(1)
                mois = date_match.group(2)
                annee = f"20{date_match.group(3)}"
                date_format = f"{jour}/{mois}/{annee}"
                
                montant = float(montant_match.group(1).replace(',', '.'))
                
                start_idx = date_match.end()
                end_idx = montant_match.start()
                middle_text = line.strip()[start_idx:end_idx].strip()
                
                transactions.append({
                    'Date': date_format,
                    'Libellé': middle_text,
                    'Montant': -montant
                })
            except:
                pass
    
    return transactions


def extract_lcl_transactions(lines: List[str]) -> List[Dict]:
    """
    Format LCL - PAIEMENTS PAR CARTE
    VERSION AVEC LOGS DÉTAILLÉS POUR DEBUG
    """
    transactions = []
    
    logger.info("=" * 80)
    logger.info("🔍 DÉBUT DU PARSING LCL")
    logger.info(f"📊 Nombre total de lignes reçues: {len(lines)}")
    
    # Dictionnaire des mois
    mois_dict = {
        'JANVIER': '01', 'FÉVRIER': '02', 'FEVRIER': '02',
        'MARS': '03', 'AVRIL': '04', 'MAI': '05', 'JUIN': '06',
        'JUILLET': '07', 'AOÛT': '08', 'AOUT': '08',
        'SEPTEMBRE': '09', 'OCTOBRE': '10', 'NOVEMBRE': '11',
        'DÉCEMBRE': '12', 'DECEMBRE': '12'
    }
    
    # === ÉTAPE 1: Détecter mois et année ===
    annee = None
    mois_num = None
    
    logger.info("\n📅 ÉTAPE 1: Recherche du mois et de l'année...")
    for idx, line in enumerate(lines[:30]):
        if 'PAIEMENTS PAR CARTE' in line.upper():
            logger.info(f"   Ligne {idx}: {line}")
            match = re.search(r"PAIEMENTS PAR CARTE D[E']?\s*([A-ZÉÈÊÀÙ]+)\s+(\d{4})", line.upper())
            if match:
                mois_txt = match.group(1).upper()
                annee = match.group(2)
                mois_num = mois_dict.get(mois_txt, None)
                logger.info(f"✅ TROUVÉ: Mois={mois_txt} ({mois_num}), Année={annee}")
                break
    
    if not annee:
        annee = '2025'
        logger.warning(f"⚠️ Mois/Année non détectés, utilisation par défaut: {annee}")
    
    # === ÉTAPE 2: Identifier la section de transactions ===
    logger.info("\n📍 ÉTAPE 2: Identification de la section des transactions...")
    
    start_idx = None
    end_idx = len(lines)
    
    for idx, line in enumerate(lines):
        if 'PAIEMENTS PAR CARTE' in line.upper():
            start_idx = idx + 1
            logger.info(f"   Début de section trouvé à la ligne {idx}")
        if start_idx and 'TOTAUX' in line.upper():
            end_idx = idx
            logger.info(f"   Fin de section trouvée à la ligne {idx}")
            break
    
    if not start_idx:
        logger.error("❌ Section PAIEMENTS PAR CARTE non trouvée!")
        return []
    
    transaction_lines = lines[start_idx:end_idx]
    logger.info(f"✅ Section identifiée: lignes {start_idx} à {end_idx} ({len(transaction_lines)} lignes)")
    
    # === ÉTAPE 3: Parser les transactions ===
    logger.info("\n💳 ÉTAPE 3: Parsing des transactions...")
    
    skip_keywords = [
        'SOUS TOTAL', 'LIBELLE', 'VALEUR', 'DEBIT', 'CREDIT', 
        'CARTE N°', 'Page', 'Crédit Lyonnais', 'SIREN', 'RCS', 'ORIAS',
        'Indicatif', 'Compte'
    ]
    
    i = 0
    transaction_count = 0
    
    while i < len(transaction_lines):
        line = transaction_lines[i].strip()
        
        # Ignorer lignes vides
        if not line:
            i += 1
            continue
        
        # Ignorer mots-clés
        if any(skip in line for skip in skip_keywords):
            logger.debug(f"   [{i}] SKIP (keyword): {line[:50]}")
            i += 1
            continue
        
        # Chercher pattern "LE JJ/MM"
        date_match = re.search(r'LE\s+(\d{1,2})/(\d{1,2})', line)
        
        if date_match:
            jour = date_match.group(1).zfill(2)
            mois = date_match.group(2).zfill(2)
            
            # Calculer l'année correcte
            if mois_num and int(mois) < int(mois_num):
                annee_trans = annee
            elif mois_num and int(mois) > int(mois_num):
                if int(mois_num) == 12 and int(mois) == 1:
                    annee_trans = str(int(annee) - 1)
                else:
                    annee_trans = annee
            else:
                annee_trans = annee
            
            date_format = f"{jour}/{mois}/{annee_trans}"
            libelle = line.strip()
            
            logger.debug(f"\n   [{i}] DATE TROUVÉE: {line}")
            
            # CASE 1: Montant sur la même ligne
            montant_match = re.search(r'(\d{1,}[,\.]\d{2})\s*$', line)
            
            if montant_match:
                try:
                    montant = float(montant_match.group(1).replace(',', '.'))
                    libelle = line[:montant_match.start()].strip()
                    
                    if len(libelle) >= 3:
                        transaction_count += 1
                        transactions.append({
                            'Date': date_format,
                            'Libellé': libelle,
                            'Montant': -montant
                        })
                        logger.info(f"   ✅ Transaction #{transaction_count}: {date_format} | {libelle[:30]} | {montant}€")
                except Exception as e:
                    logger.warning(f"   ⚠️ Erreur parsing (même ligne): {str(e)}")
            
            # CASE 2: Montant sur la ligne suivante
            elif i + 1 < len(transaction_lines):
                next_line = transaction_lines[i + 1].strip()
                logger.debug(f"   [{i+1}] Ligne suivante: {next_line}")
                
                # Pattern: montant seul ou avec texte après
                montant_match = re.match(r'^(\d{1,}[,\.]\d{2})', next_line)
                
                if montant_match:
                    try:
                        montant = float(montant_match.group(1).replace(',', '.'))
                        
                        if len(libelle) >= 3:
                            transaction_count += 1
                            transactions.append({
                                'Date': date_format,
                                'Libellé': libelle,
                                'Montant': -montant
                            })
                            logger.info(f"   ✅ Transaction #{transaction_count}: {date_format} | {libelle[:30]} | {montant}€ (ligne suivante)")
                            i += 1  # Sauter la ligne du montant
                    except Exception as e:
                        logger.warning(f"   ⚠️ Erreur parsing (ligne suivante): {str(e)}")
                else:
                    logger.debug(f"   ⚠️ Pas de montant trouvé sur ligne suivante")
            
            else:
                logger.debug(f"   ⚠️ Pas de ligne suivante disponible")
        
        else:
            # Ligne sans date "LE JJ/MM"
            if re.match(r'^\d{1,}[,\.]\d{2}$', line):
                logger.debug(f"   [{i}] Montant isolé (déjà traité?): {line}")
            else:
                logger.debug(f"   [{i}] Autre: {line[:50]}")
        
        i += 1
    
    logger.info("\n" + "=" * 80)
    logger.info(f"✅ PARSING TERMINÉ: {len(transactions)} transactions extraites")
    logger.info("=" * 80)
    
    return transactions


# ============================================================================
# EXTRACTION PRINCIPALE
# ============================================================================

def extract_from_pdf(pdf_bytes: bytes, enable_debug: bool = False) -> Tuple[List[Dict], str]:
    """
    Extrait transactions depuis PDF
    VERSION SIMPLIFIÉE : pdfplumber d'abord, puis Mistral si échec
    """
    try:
        # ÉTAPE 1: Extraction avec pdfplumber (fonctionne pour 95% des PDFs)
        import io
        import pdfplumber
        
        pdf_file = io.BytesIO(pdf_bytes)
        text = ""
        
        logger.info("📄 Extraction du texte avec pdfplumber...")
        
        with pdfplumber.open(pdf_file) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                    logger.debug(f"Page {i+1}: {len(page_text)} caractères extraits")
        
        logger.info(f"✅ Texte total extrait: {len(text)} caractères")
        
        # Si vraiment aucun texte, tenter OCR (sera skip si Tesseract non installé)
        if not text or len(text.strip()) < 100:
            logger.warning("⚠️ Peu de texte extrait, tentative OCR...")
            try:
                from ocr_utils import extract_text_from_scanned_pdf
                text = extract_text_from_scanned_pdf(pdf_bytes)
                logger.info(f"✅ OCR: {len(text)} caractères extraits")
            except Exception as ocr_error:
                logger.warning(f"⚠️ OCR non disponible: {str(ocr_error)}")
                # Continuer quand même avec le texte pdfplumber
        
        if enable_debug:
            logger.info(f"🔍 Premiers 500 caractères: {text[:500]}")
        
        # ÉTAPE 2: Détection de la banque
        bank_type = detect_bank_format(text)
        logger.info(f"🏦 Banque détectée: {bank_type}")
        
        # ÉTAPE 3: Parsing selon la banque
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        logger.info(f"📄 Lignes non-vides: {len(lines)}")
        
        transactions = []
        
        if bank_type == "CA":
            transactions = extract_ca_transactions(lines)
        elif bank_type == "BP":
            transactions = extract_bp_transactions(lines)
        elif bank_type == "LCL":
            transactions = extract_lcl_transactions(lines)
        
        # ÉTAPE 4: Fallback Mistral AI si échec
        if not transactions or len(transactions) == 0:
            logger.warning(f"⚠️ Parser {bank_type} échoué, fallback Mistral AI...")
            
            try:
                from mistral_parser import extract_with_mistral
                transactions = extract_with_mistral(text, bank_type)
                
                if transactions and len(transactions) > 0:
                    logger.info(f"✅ Mistral AI: {len(transactions)} transactions")
                    return transactions, "MISTRAL_AI"
                else:
                    logger.error("❌ Mistral AI: 0 transactions")
                    return [], "ERROR"
            
            except Exception as mistral_error:
                logger.error(f"❌ Mistral échoué: {str(mistral_error)}")
                return [], "ERROR"
        
        logger.info(f"✅ {len(transactions)} transactions extraites")
        return transactions, bank_type
        
    except Exception as e:
        logger.error(f"❌ Erreur extraction: {str(e)}", exc_info=True)
        return [], "ERROR"



# ============================================================================
# GÉNÉRATION EXCEL
# ============================================================================

def generate_excel(transactions: List[Dict]) -> bytes:
    """Génère fichier Excel depuis transactions"""
    if not transactions:
        return None
    
    df = pd.DataFrame(transactions)
    
    # Convertir la colonne Date en datetime
    df['Date'] = pd.to_datetime(df['Date'], format='%d/%m/%Y', errors='coerce')
    
    # Supprimer les lignes avec dates invalides
    df = df.dropna(subset=['Date'])
    
    # Reformater la date
    df['Date'] = df['Date'].dt.strftime('%d/%m/%Y')
    
    if df.empty:
        return None
    
    # Créer le fichier Excel en mémoire
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df[['Date', 'Libellé', 'Montant']].to_excel(
            writer, 
            index=False, 
            sheet_name='Relevé'
        )
        
        # Ajuster les largeurs de colonnes
        ws = writer.sheets['Relevé']
        ws.column_dimensions['A'].width = 12  # Date
        ws.column_dimensions['B'].width = 50  # Libellé
        ws.column_dimensions['C'].width = 15  # Montant
    
    output.seek(0)
    return output.getvalue()
