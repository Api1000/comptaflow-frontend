#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COMPTAFLOW - Module OCR
Extraction de texte depuis PDFs scannés via Tesseract OCR
"""

import pytesseract
from pdf2image import convert_from_bytes
import cv2
import numpy as np
from PIL import Image
import logging
from typing import Tuple

logger = logging.getLogger(__name__)


def is_scanned_pdf(pdf_bytes: bytes, threshold: float = 0.8) -> bool:
    """
    Détecte si un PDF est scanné (image) ou natif (texte)
    VERSION CORRIGÉE : plus tolérante
    """
    try:
        import pdfplumber
        import io
        import re
        
        pdf_file = io.BytesIO(pdf_bytes)
        
        with pdfplumber.open(pdf_file) as pdf:
            if len(pdf.pages) == 0:
                return True
            
            # Analyser TOUTES les pages (pas seulement la première)
            total_text = ""
            for page in pdf.pages[:3]:  # Analyser les 3 premières pages
                page_text = page.extract_text() or ""
                total_text += page_text
            
            # Si peu de texte total, c'est probablement scanné
            if len(total_text.strip()) < 200:
                logger.info(f"📸 PDF détecté comme scanné ({len(total_text)} caractères)")
                return True
            
            # Compter les mots significatifs (au moins 3 lettres)
            words = re.findall(r'\b[a-zA-ZÀ-ÿ]{3,}\b', total_text)
            
            if len(words) < 50:  # Seuil abaissé : 50 au lieu de 20
                logger.info(f"📸 PDF détecté comme scanné ({len(words)} mots)")
                return True
            
            # Vérifier mots bancaires courants
            common_bank_words = [
                'BANQUE', 'CREDIT', 'COMPTE', 'RELEVE', 'TRANSACTION',
                'DEBIT', 'CARTE', 'PAIEMENT', 'MONTANT', 'DATE', 'LCL'
            ]
            
            text_upper = total_text.upper()
            bank_words_found = sum(1 for word in common_bank_words if word in text_upper)
            
            if bank_words_found >= 2:
                logger.info(f"📄 PDF détecté comme natif ({len(words)} mots, {bank_words_found} mots bancaires)")
                return False
            
            logger.info(f"📸 PDF détecté comme scanné ({bank_words_found} mots bancaires seulement)")
            return True
            
    except Exception as e:
        logger.error(f"❌ Erreur détection type PDF: {str(e)}")
        # En cas de doute, considérer comme natif (pas scanné)
        return False  # ← CHANGEMENT ICI : False par défaut au lieu de True



def preprocess_image(image: Image.Image) -> Image.Image:
    """
    Prétraitement d'image pour améliorer l'OCR
    - Conversion en niveaux de gris
    - Augmentation du contraste
    - Suppression du bruit
    """
    try:
        # Convertir PIL Image en numpy array
        img_array = np.array(image)
        
        # Conversion en niveaux de gris
        if len(img_array.shape) == 3:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_array
        
        # Augmenter le contraste (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        # Débruitage
        denoised = cv2.fastNlMeansDenoising(enhanced, None, 10, 7, 21)
        
        # Binarisation adaptative
        binary = cv2.adaptiveThreshold(
            denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        
        # Reconvertir en PIL Image
        return Image.fromarray(binary)
    except Exception as e:
        logger.warning(f"⚠️ Erreur preprocessing, utilisation image originale: {str(e)}")
        return image


def extract_text_from_scanned_pdf(pdf_bytes: bytes, lang: str = 'fra') -> str:
    """
    Extrait le texte d'un PDF scanné via OCR
    
    Args:
        pdf_bytes: Contenu du PDF
        lang: Langue pour Tesseract ('fra' pour français)
    
    Returns:
        Texte extrait
    """
    try:
        logger.info("🔍 Conversion du PDF en images (OCR)...")
        
        # Convertir le PDF en images (DPI 300 pour meilleure qualité)
        images = convert_from_bytes(
            pdf_bytes,
            dpi=300,
            fmt='png'
        )
        
        logger.info(f"📄 {len(images)} page(s) converties en images")
        
        extracted_texts = []
        
        for i, image in enumerate(images, 1):
            logger.info(f"🔍 OCR page {i}/{len(images)}...")
            
            # Prétraiter l'image
            processed_image = preprocess_image(image)
            
            # Appliquer l'OCR
            text = pytesseract.image_to_string(
                processed_image,
                lang=lang,
                config='--psm 6'  # PSM 6 = bloc de texte uniforme
            )
            
            extracted_texts.append(text)
            logger.info(f"✅ Page {i} : {len(text)} caractères extraits")
        
        # Combiner tout le texte
        full_text = '\n\n'.join(extracted_texts)
        logger.info(f"✅ OCR terminé : {len(full_text)} caractères au total")
        
        return full_text
        
    except Exception as e:
        logger.error(f"❌ Erreur OCR: {str(e)}")
        raise Exception(f"Erreur lors de l'OCR: {str(e)}")


def extract_text_smart(pdf_bytes: bytes) -> Tuple[str, bool]:
    """
    Extraction intelligente : détecte automatiquement si PDF natif ou scanné
    
    Args:
        pdf_bytes: Contenu du PDF
    
    Returns:
        Tuple (texte_extrait, was_scanned)
    """
    if is_scanned_pdf(pdf_bytes):
        logger.info("📸 PDF scanné détecté, utilisation de l'OCR...")
        text = extract_text_from_scanned_pdf(pdf_bytes)
        return text, True
    else:
        logger.info("📄 PDF natif détecté, extraction directe...")
        # Utiliser la méthode existante
        from parsers import extract_text_from_pdf
        text = extract_text_from_pdf(pdf_bytes)
        return text, False
