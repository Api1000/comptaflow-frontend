#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
COMPTAFLOW - Backend FastAPI
Production-ready avec Auth, JWT, Upload Processing, PostgreSQL, Discord Notifications, Mistral AI
"""

from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status, Header, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, HTMLResponse
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
from jose import jwt
import bcrypt
import os
from typing import List, Dict, Optional
import io
import uuid
from pathlib import Path
import base64
import logging
import aiohttp

# PostgreSQL
from sqlalchemy.orm import Session
from database import get_db, User, Upload, UsageLog, GuestConversion, FailedConversion

# Stripe
import stripe

# Bank detection
from bank_detector import validate_statement, count_transactions, get_supported_banks

# Parsers (ancien module séparé)
from parsers import extract_text_from_pdf, extract_from_pdf, generate_excel

# ✅ NOUVEAU : Mistral AI Parser
from mistral_parsers import extract_with_mistral_detailed

import sys

# Forcer l'affichage immédiat des logs (sans buffer)
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# ✅ Mode debug Mistral
DEBUG_MISTRAL = os.getenv("DEBUG_MISTRAL", "False").lower() == "true"

# Logging
logging.basicConfig(
    level=logging.DEBUG if DEBUG_MISTRAL else logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True
)

logger = logging.getLogger(__name__)
logging.getLogger("parsers").setLevel(logging.INFO)
logging.getLogger("uvicorn").setLevel(logging.WARNING)
logging.getLogger("bank_detector").setLevel(logging.INFO)
logging.getLogger("mistral_parsers").setLevel(logging.DEBUG if DEBUG_MISTRAL else logging.INFO)

# FastAPI App
app = FastAPI(
    title="ComptaFlow",
    description="Convertir relevés PDF en Excel avec Mistral AI",
    version="2.1.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# MODELS
# ============================================================================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    fullname: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

class UploadResponse(BaseModel):
    upload_id: Optional[str] = None
    status: str
    transactions_count: int = 0
    bank_detected: Optional[str] = None
    message: str
    error: Optional[str] = None
    error_type: Optional[str] = None
    supported_banks: Optional[dict] = None
    can_report: Optional[bool] = None
    extraction_method: Optional[str] = None  # ✅ NOUVEAU : "mistral-ai" ou "regex"

class SupportContactRequest(BaseModel):
    subject: str
    message: str

class DebugPdfResponse(BaseModel):
    filename: str
    filesize: int
    is_scanned: bool
    extraction_method: str
    text_length: int
    text_preview: str
    bank_detected: Optional[str]
    bank_keywords_found: Dict[str, List[str]]
    validation_result: Dict
    lines_count: int
    first_50_lines: List[str]

# ============================================================================
# AUTH UTILITIES
# ============================================================================

def hash_password(password: str) -> str:
    """Hash password avec bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()

def verify_password(password: str, hashed: str) -> bool:
    """Vérifier password"""
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Créer JWT token"""
    to_encode = data.copy()
    if expires_delta is None:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    """Vérifier JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(authorization: Optional[str] = Header(None)):
    """Dépendance pour vérifier l'utilisateur depuis le header Authorization"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No token provided")
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        return verify_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token format")

# ============================================================================
# DISCORD NOTIFICATIONS
# ============================================================================

async def send_discord_notification(failed_conversion: dict):
    """Envoie une notification Discord pour un PDF non supporté"""
    DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
    if not DISCORD_WEBHOOK_URL:
        logger.warning("Discord webhook non configuré")
        return
    
    embed = {
        "embeds": [{
            "title": "🚨 Nouveau PDF non supporté détecté",
            "description": "Un utilisateur a uploadé un PDF incompatible avec ComptaFlow",
            "color": 15158332,  # Rouge
            "fields": [
                {"name": "📄 Nom du fichier", "value": failed_conversion["filename"], "inline": False},
                {"name": "👤 Utilisateur", "value": failed_conversion["user_email"], "inline": True},
                {"name": "🏦 Banque détectée", "value": failed_conversion["bank_name"] or "Inconnue", "inline": True},
                {"name": "❌ Message d'erreur", "value": failed_conversion["error_message"][:1024], "inline": False},
                {"name": "🆔 ID du record", "value": f"#{failed_conversion['id']}", "inline": True},
                {"name": "📅 Date", "value": f"<t:{int(failed_conversion['reported_at'].timestamp())}:F>", "inline": True},
            ],
            "footer": {"text": "ComptaFlow - Système de détection automatique"},
            "timestamp": failed_conversion["reported_at"].isoformat()
        }]
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(DISCORD_WEBHOOK_URL, json=embed) as resp:
                if resp.status == 204:
                    logger.info(f"✅ Notification Discord envoyée pour {failed_conversion['filename']}")
                else:
                    error_text = await resp.text()
                    logger.error(f"❌ Erreur Discord webhook (status {resp.status}): {error_text}")
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'envoi Discord: {str(e)}")

async def send_discord_support_message(support_data: dict):
    """Envoie un message de support vers Discord"""
    DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
    if not DISCORD_WEBHOOK_URL:
        logger.warning("Discord webhook non configuré")
        return
    
    embed = {
        "embeds": [{
            "title": "💬 Nouveau message de support",
            "description": "Un utilisateur a envoyé un message via le formulaire de contact",
            "color": 5793266,  # Bleu
            "fields": [
                {"name": "👤 Utilisateur", "value": support_data["user_email"], "inline": True},
                {"name": "📦 Plan", "value": support_data["subscription_tier"].upper(), "inline": True},
                {"name": "📝 Sujet", "value": support_data["subject"][:256], "inline": False},
                {"name": "💬 Message", "value": support_data["message"][:1024] if len(support_data["message"]) <= 1024 else support_data["message"][:1021] + "...", "inline": False},
            ],
            "footer": {"text": "ComptaFlow - Support"},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }]
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(DISCORD_WEBHOOK_URL, json=embed) as resp:
                if resp.status == 204:
                    logger.info(f"✅ Message de support envoyé sur Discord pour {support_data['user_email']}")
                else:
                    error_text = await resp.text()
                    logger.error(f"❌ Erreur Discord webhook (status {resp.status}): {error_text}")
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'envoi Discord: {str(e)}")

# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@app.post("/auth/register")
async def register(user: UserRegister, db: Session = Depends(get_db)):
    """Inscription d'un nouvel utilisateur"""
    logger.info(f"📝 Registration attempt for {user.email}")
    
    # Vérifier si l'utilisateur existe déjà
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        logger.warning(f"⚠️ User already exists: {user.email}")
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    
    try:
        # Hasher le mot de passe
        hashed_password = bcrypt.hashpw(
            user.password.encode("utf-8"), 
            bcrypt.gensalt()
        ).decode("utf-8")
        
        # Créer l'utilisateur
        new_user = User(
            email=user.email,
            password_hash=hashed_password,
            fullname=user.fullname,
            subscription_tier="free"
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info(f"✅ User registered successfully: {user.email}")
        
        # Créer le token JWT
        access_token = create_access_token(data={"sub": user.email})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "email": new_user.email,
                "fullname": new_user.fullname,
                "subscription_tier": new_user.subscription_tier
            }
        }
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Registration error for {user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'inscription")

@app.post("/auth/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
    """Endpoint de connexion - PostgreSQL"""
    stored_user = db.query(User).filter(User.email == user.email).first()
    
    if not stored_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(user.password, stored_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "email": user.email,
            "fullname": stored_user.fullname
        }
    }

@app.get("/me")
async def get_current_user_info(email: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Récupérer les informations de l'utilisateur connecté"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        logger.error(f"❌ User not found in /me endpoint: {email}")
        raise HTTPException(status_code=404, detail="User not found")
    
    # Récupérer les stats d'utilisation du mois en cours
    today = datetime.now(timezone.utc)
    usage = db.query(UsageLog).filter(
        UsageLog.user_id == user.id,
        UsageLog.month == today.month,
        UsageLog.year == today.year
    ).first()
    
    # Définir les limites selon le plan
    limits = {"free": 5, "premium": 50, "pro": None}  # Illimité
    user_limit = limits.get(user.subscription_tier, 5)
    current_usage = usage.uploads_count if usage else 0
    
    logger.info(f"ℹ️ User info retrieved: {email} - Plan: {user.subscription_tier}")
    
    return {
        "id": str(user.id),
        "email": user.email,
        "fullname": user.fullname,
        "subscription_tier": user.subscription_tier,
        "stripe_customer_id": user.stripe_customer_id,
        "created_at": user.created_at.isoformat(),
        "updated_at": user.updated_at.isoformat(),
        "usage": {
            "current_month_uploads": current_usage,
            "limit": user_limit,
            "remaining": user_limit - current_usage if user_limit else None,
            "percentage": round((current_usage / user_limit) * 100, 1) if user_limit else 0
        }
    }

# ============================================================================
# GUEST ENDPOINTS
# ============================================================================

@app.get("/check-guest-eligibility")
async def check_guest_eligibility(request: Request, db: Session = Depends(get_db)):
    """Vérifier si l'IP peut encore faire une conversion gratuite"""
    client_ip = request.client.host
    existing = db.query(GuestConversion).filter(
        GuestConversion.ip_address == client_ip
    ).first()
    return {"eligible": existing is None, "ip": client_ip}

@app.post("/upload-guest")
async def upload_pdf_guest(
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Upload guest avec limitation par IP"""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
    
    client_ip = request.client.host
    user_agent = request.headers.get("user-agent", "")
    
    logger.info(f"🎁 Guest conversion attempt from IP: {client_ip}")
    
    # Vérifier si cette IP a déjà converti
    existing = db.query(GuestConversion).filter(
        GuestConversion.ip_address == client_ip
    ).first()
    
    if existing:
        logger.warning(f"⚠️ IP {client_ip} already used free trial")
        raise HTTPException(
            status_code=403,
            detail="Vous avez déjà utilisé votre conversion gratuite. Créez un compte pour continuer !"
        )
    
    # Lire et traiter le PDF
    pdf_bytes = await file.read()
    transactions, bank_type = extract_from_pdf(pdf_bytes)
    excel_bytes = generate_excel(transactions)
    
    if not excel_bytes:
        raise HTTPException(status_code=400, detail="No transactions found")
    
    # Enregistrer la conversion
    new_conversion = GuestConversion(
        ip_address=client_ip,
        user_agent=user_agent
    )
    db.add(new_conversion)
    db.commit()
    
    logger.info(f"✅ Guest conversion recorded for IP: {client_ip}")
    
    filename = file.filename.replace(".pdf", "_EXTRAIT.xlsx")
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "X-Free-Trial-Used": "true"
        }
    )

# ============================================================================
# MAIN UPLOAD ENDPOINT (WITH MISTRAL AI)
# ============================================================================

@app.post("/upload", response_model=UploadResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    email: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload et traiter PDF avec MISTRAL AI + VALIDATION AUTOMATIQUE
    
    - Détecte la banque
    - Vérifier la compatibilité
    - Détecte les PDFs scannés
    - Enregistre automatiquement dans failed_conversions si incompatible
    - Envoie notification Discord (sauf pour les scans)
    - ✅ Convertit avec Mistral AI si compatible
    """
    logger.info("=" * 80)
    logger.info(f"📤 UPLOAD REÇU: {file.filename} par {email}")
    logger.info("=" * 80)
    
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés")
    
    # Récupérer l'utilisateur
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Vérifier les limites d'utilisation
    today = datetime.now(timezone.utc)
    usage = db.query(UsageLog).filter(
        UsageLog.user_id == user.id,
        UsageLog.month == today.month,
        UsageLog.year == today.year
    ).first()
    
    if not usage:
        usage = UsageLog(user_id=user.id, month=today.month, year=today.year, uploads_count=0)
        db.add(usage)
        db.commit()
    
    limits = {"free": 5, "premium": 50, "pro": None}
    user_limit = limits.get(user.subscription_tier, 5)
    
    if user_limit and usage.uploads_count >= user_limit:
        raise HTTPException(
            status_code=403,
            detail=f"Limite mensuelle atteinte ({user_limit} conversions). Passez à un plan supérieur."
        )
    
    # Lire le fichier
    pdf_bytes = await file.read()
    
    try:
        # ÉTAPE 1: EXTRACTION DU TEXTE
        logger.info("📄 Extraction du texte du PDF...")
        text = extract_text_from_pdf(pdf_bytes)
        
        if not text or len(text) < 100:
            raise HTTPException(
                status_code=400,
                detail="Le PDF semble vide ou illisible. Assurez-vous qu'il contient du texte extractible."
            )
        
        logger.info(f"✅ Texte extrait: {len(text)} caractères")
        
        # ÉTAPE 2: VALIDATION AUTOMATIQUE
        logger.info("🔍 Validation de la compatibilité...")
        validation_result = validate_statement(text)
        
        logger.info(f"ℹ️ Validation result: compatible={validation_result['compatible']}, bank={validation_result.get('bank')}")
        
        # Si NON COMPATIBLE: Enregistrer et notifier
        if not validation_result["compatible"]:
            error_type = validation_result.get("error_type", "UNKNOWN")
            logger.warning(f"⚠️ PDF non compatible ({error_type}) - {file.filename} par {user.email}")
            
            # NE PAS enregistrer les PDFs scannés (trop nombreux, pas utile)
            if error_type != "SCANNED_PDF":
                # Encoder le PDF en base64
                pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
                
                # Insérer dans la base de données
                failed_conversion = FailedConversion(
                    user_id=user.id,
                    user_email=user.email,
                    filename=file.filename,
                    bank_name=validation_result.get("bank", "Inconnue"),
                    error_message=f"{error_type}: {validation_result['message']}"[:500],
                    user_comment="Enregistrement automatique lors de l'upload",
                    file_content=pdf_base64,
                    reported_at=datetime.now(timezone.utc),
                    status="pending"
                )
                db.add(failed_conversion)
                db.commit()
                db.refresh(failed_conversion)
                
                logger.info(f"💾 Failed conversion enregistré (ID={failed_conversion.id})")
                
                # NOTIFICATION DISCORD uniquement pour banques non supportées
                if error_type == "BANK_NOT_SUPPORTED":
                    await send_discord_notification({
                        "id": failed_conversion.id,
                        "filename": failed_conversion.filename,
                        "user_email": failed_conversion.user_email,
                        "bank_name": failed_conversion.bank_name,
                        "error_message": failed_conversion.error_message,
                        "reported_at": failed_conversion.reported_at
                    })
                    logger.info("📢 Notification Discord envoyée")
            else:
                logger.info("🚫 PDF scanné ignoré (non enregistré)")
            
            # Retourner l'erreur au frontend avec message détaillé
            return UploadResponse(
                upload_id=None,
                status="error",
                transactions_count=0,
                bank_detected=validation_result.get("bank", "UNKNOWN"),
                message=validation_result["message"],
                error=error_type,
                error_type=error_type,
                supported_banks=validation_result.get("supported_banks", {}),
                can_report=(error_type != "SCANNED_PDF"),  # Pas de signalement pour les scans
                extraction_method=None
            )
        
        # ÉTAPE 3: EXTRACTION AVEC MISTRAL AI ✅
        bank_type = validation_result["bank"]
        logger.info(f"✅ Validation réussie: {bank_type}")
        logger.info("🤖 Extraction des transactions avec Mistral AI...")
        
        try:
            # ✅ APPEL À MISTRAL AI (avec debug si activé)
            mistral_result = extract_with_mistral_detailed(
                text=text,
                bank_type=bank_type,
                debug=DEBUG_MISTRAL  # Active le debug si DEBUG_MISTRAL=True
            )
            
            if not mistral_result["success"] or mistral_result["count"] == 0:
                logger.error("❌ Aucune transaction extraite par Mistral AI")
                raise HTTPException(
                    status_code=400,
                    detail="Aucune transaction trouvée dans ce relevé. Vérifiez le format du PDF."
                )
            
            transactions = mistral_result["transactions"]
            logger.info(f"✅ {len(transactions)} transactions extraites par Mistral AI")
            
            extraction_method = "mistral-ai"
            
        except Exception as mistral_error:
            logger.error(f"❌ Erreur Mistral AI: {str(mistral_error)}")
            logger.info("🔄 Fallback sur le parser regex classique...")
            
            # Fallback sur l'ancien parser si Mistral échoue
            try:
                transactions, _ = extract_from_pdf(pdf_bytes)
                extraction_method = "regex-fallback"
                
                if not transactions or len(transactions) == 0:
                    raise HTTPException(
                        status_code=400,
                        detail="Aucune transaction trouvée avec les méthodes disponibles."
                    )
                
                logger.info(f"✅ {len(transactions)} transactions extraites (fallback regex)")
                
            except Exception as fallback_error:
                logger.error(f"❌ Erreur fallback: {str(fallback_error)}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Impossible d'extraire les transactions: {str(fallback_error)}"
                )
        
        # ÉTAPE 4: GÉNÉRATION DU FICHIER EXCEL
        logger.info("📊 Génération du fichier Excel...")
        excel_bytes = generate_excel(transactions)
        
        if not excel_bytes:
            logger.error("❌ Erreur génération Excel")
            raise HTTPException(status_code=400, detail="Erreur lors de la génération du fichier Excel")
        
        # ÉTAPE 5: SAUVEGARDER dans la base de données
        new_upload = Upload(
            user_id=user.id,
            filename=file.filename,
            bank_type=bank_type,
            transaction_count=len(transactions),
            excel_data=excel_bytes
        )
        db.add(new_upload)
        
        # Incrémenter le compteur d'utilisation
        usage.uploads_count += 1
        db.commit()
        db.refresh(new_upload)
        
        logger.info("=" * 80)
        logger.info(f"✅ CONVERSION RÉUSSIE")
        logger.info(f"   User: {email}")
        logger.info(f"   Bank: {bank_type}")
        logger.info(f"   Transactions: {len(transactions)}")
        logger.info(f"   Method: {extraction_method}")
        logger.info(f"   Usage: {usage.uploads_count}/{user_limit if user_limit else '∞'} ce mois")
        logger.info("=" * 80)
        
        return UploadResponse(
            upload_id=str(new_upload.id),
            status="success",
            transactions_count=len(transactions),
            bank_detected=bank_type,
            message=f"{len(transactions)} transactions extraites avec succès ! ({usage.uploads_count}/{user_limit if user_limit else '∞'} ce mois)",
            extraction_method=extraction_method
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erreur inattendue: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")

# ============================================================================
# VALIDATION ENDPOINT
# ============================================================================

@app.post("/validate-statement")
async def validate_bank_statement(
    file: UploadFile = File(...),
    email: str = Depends(get_current_user)
):
    """
    Valide si un relevé bancaire est compatible avant conversion
    - Détecte automatiquement la banque
    - Vérifie le format et la structure
    - Retourne des informations détaillées
    """
    try:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Seuls les fichiers PDF sont acceptés"
            )
        
        content = await file.read()
        text = extract_text_from_pdf(content)
        
        if not text or len(text) < 100:
            raise HTTPException(
                status_code=400,
                detail="Le PDF semble vide ou illisible. Assurez-vous qu'il contient du texte extractible."
            )
        
        validation_result = validate_statement(text)
        
        if validation_result["compatible"]:
            transaction_count = count_transactions(text, validation_result["bank"])
            validation_result["estimated_transactions"] = transaction_count
        
        logger.info(
            f"🔍 Validation statement - User: {email}, "
            f"Bank: {validation_result.get('bank', 'UNKNOWN')}, "
            f"Compatible: {validation_result['compatible']}"
        )
        
        return validation_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error validating statement: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la validation: {str(e)}")

# ============================================================================
# DEBUG ENDPOINT
# ============================================================================

@app.post("/debug-pdf", response_model=DebugPdfResponse)
async def debug_pdf(
    file: UploadFile = File(...),
    email: str = Depends(get_current_user)
):
    """
    Endpoint de diagnostic pour analyser un PDF problématique
    Retourne toutes les informations d'extraction et de détection
    """
    logger.info(f"🐛 DEBUG PDF: {file.filename} par {email}")
    
    pdf_bytes = await file.read()
    
    # ÉTAPE 1: Extraction du texte
    try:
        text = extract_text_from_pdf(pdf_bytes)
        extraction_method = "pdfplumber"
        is_scanned = len(text) < 100
    except Exception as e:
        logger.error(f"❌ Erreur extraction: {str(e)}")
        text = f"ERROR: {str(e)}"
        extraction_method = f"ERROR: {str(e)}"
        is_scanned = True
    
    # ÉTAPE 2: Validation
    validation_result = validate_statement(text) if text and len(text) > 100 else {
        "compatible": False,
        "bank": None,
        "message": "PDF scanné ou illisible"
    }
    
    # ÉTAPE 3: Analyse détaillée
    lines = text.split("\n")
    
    # Recherche de mots-clés bancaires
    bank_keywords_found = {}
    keywords = {
        "Crédit Mutuel": ["CREDIT MUTUEL", "CM11", "CMUT"],
        "BNP Paribas": ["BNP PARIBAS", "BNPP"],
        "Société Générale": ["SOCIETE GENERALE", "SG"],
        "Caisse d'Épargne": ["CAISSE D'EPARGNE", "CAISSE EPARGNE"],
        "LCL": ["LCL", "CREDIT LYONNAIS"],
        "Banque Populaire": ["BANQUE POPULAIRE", "BP"],
        "La Banque Postale": ["BANQUE POSTALE", "LA POSTE"],
    }
    
    for bank, kws in keywords.items():
        found = [kw for kw in kws if kw.upper() in text.upper()]
        if found:
            bank_keywords_found[bank] = found
    
    return DebugPdfResponse(
        filename=file.filename,
        filesize=len(pdf_bytes),
        is_scanned=is_scanned,
        extraction_method=extraction_method,
        text_length=len(text),
        text_preview=text[:2000],
        bank_detected=validation_result.get("bank"),
        bank_keywords_found=bank_keywords_found,
        validation_result=validation_result,
        lines_count=len(lines),
        first_50_lines=lines[:50]
    )

# ============================================================================
# SUPPORT & REPORTING
# ============================================================================

@app.get("/supported-banks")
async def get_supported_banks_endpoint():
    """Retourne la liste des banques actuellement supportées"""
    banks = get_supported_banks()
    return {
        "count": len(banks),
        "banks": banks,
        "details": {
            bank_code: {
                "name": description,
                "supported_formats": ["PDF"],
                "output_formats": ["Excel"]
            }
            for bank_code, description in banks.items()
        }
    }

@app.post("/support/contact")
async def support_contact(
    request: SupportContactRequest,
    email: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Endpoint pour recevoir les messages du formulaire de support
    Envoie une notification Discord
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    logger.info(f"💬 Support message from {email}: {request.subject}")
    
    # Envoyer notification Discord
    await send_discord_support_message({
        "user_email": email,
        "subscription_tier": user.subscription_tier,
        "subject": request.subject,
        "message": request.message
    })
    
    return {
        "success": True,
        "message": "Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais."
    }

@app.post("/report-failed-conversion")
async def report_failed_conversion(
    file: UploadFile = File(...),
    bank_name: str = Form(None),
    user_comment: str = Form(None),
    email: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Permet à l'utilisateur de signaler manuellement un relevé non compatible
    avec un commentaire additionnel (complément à l'enregistrement automatique)
    """
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        pdf_bytes = await file.read()
        pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
        
        report = FailedConversion(
            user_id=user.id,
            user_email=user.email,
            filename=file.filename,
            bank_name=bank_name or "Non spécifié",
            error_message=f"Signalement manuel: {user_comment or 'Aucun commentaire'}",
            user_comment=user_comment,
            file_content=pdf_base64,
            reported_at=datetime.now(timezone.utc),
            status="pending"
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        
        # Notification Discord
        await send_discord_notification({
            "id": report.id,
            "filename": report.filename,
            "user_email": report.user_email,
            "bank_name": report.bank_name,
            "error_message": f"Signalement manuel: {user_comment}",
            "reported_at": report.reported_at
        })
        
        logger.info(f"✅ Failed conversion reported manually - User: {user.email}, Bank: {bank_name}, File: {file.filename}")
        
        return {
            "success": True,
            "message": "Merci pour votre signalement ! Nous allons analyser ce relevé et ajouter le support de votre banque prochainement."
        }
    except Exception as e:
        logger.error(f"❌ Error reporting failed conversion: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur lors du signalement")

# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@app.get("/admin/failed-conversions")
async def get_failed_conversions(
    email: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: str = "pending",
    limit: int = 50
):
    """
    Liste les conversions échouées (admin only)
    TODO: Ajouter vérification admin
    """
    reports = db.query(FailedConversion)\
        .filter(FailedConversion.status == status)\
        .order_by(FailedConversion.reported_at.desc())\
        .limit(limit)\
        .all()
    
    return {
        "total": len(reports),
        "reports": [
            {
                "id": r.id,
                "user_email": r.user_email,
                "filename": r.filename,
                "bank_name": r.bank_name,
                "error_message": r.error_message,
                "user_comment": r.user_comment,
                "reported_at": r.reported_at.isoformat(),
                "status": r.status
            }
            for r in reports
        ]
    }

@app.get("/admin/download-failed-pdf/{report_id}")
async def download_failed_pdf(
    report_id: int,
    email: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Télécharge le PDF signalé (admin only)
    TODO: Ajouter vérification admin avec un champ 'role' dans User
    """
    report = db.query(FailedConversion).filter(FailedConversion.id == report_id).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if not report.file_content:
        raise HTTPException(status_code=404, detail="PDF content not found")
    
    # Décoder le base64
    pdf_bytes = base64.b64decode(report.file_content)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={report.filename}"
        }
    )

@app.get("/admin/pdf-downloader", response_class=HTMLResponse)
async def pdf_downloader_interface():
    """Interface web pour télécharger les PDFs échoués"""
    html_content = """
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ComptaFlow - Télécharger PDFs échoués</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 800px;
            width: 100%;
            padding: 40px;
        }
        h1 { color: #333; margin-bottom: 10px; font-size: 28px; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .login-section, .pdfs-section { margin-bottom: 30px; }
        .hidden { display: none; }
        input, button {
            width: 100%;
            padding: 12px;
            margin: 8px 0;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
        }
        button {
            background: #667eea;
            color: white;
            border: none;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
        }
        button:hover {
            background: #5568d3;
            transform: translateY(-2px);
        }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        .pdf-item {
            background: #f8f9fa;
            padding: 16px;
            margin: 12px 0;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .pdf-item h3 { color: #333; margin-bottom: 8px; font-size: 18px; }
        .pdf-info { color: #666; font-size: 14px; margin: 4px 0; }
        .pdf-item button { margin-top: 12px; width: auto; padding: 10px 24px; }
        .error {
            background: #fee;
            color: #c33;
            padding: 12px;
            border-radius: 8px;
            margin: 12px 0;
        }
        .success {
            background: #efe;
            color: #3a3;
            padding: 12px;
            border-radius: 8px;
            margin: 12px 0;
        }
        .loading { text-align: center; padding: 20px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 ComptaFlow Admin</h1>
        <p class="subtitle">Télécharger les PDFs des conversions échouées</p>
        
        <!-- Section Login -->
        <div class="login-section" id="loginSection">
            <input type="email" id="email" placeholder="Email" value="mani.delavega@gmail.com">
            <input type="password" id="password" placeholder="Password" value="">
            <button onclick="login()">Se connecter</button>
            <div id="loginError"></div>
        </div>
        
        <!-- Section PDFs -->
        <div class="pdfs-section hidden" id="pdfsSection">
            <button onclick="loadPDFs()">🔄 Actualiser la liste</button>
            <div id="pdfsList"></div>
        </div>
    </div>

    <script>
        const API_URL = window.location.origin;
        let token;

        async function login() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('loginError');
            
            try {
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    token = data.access_token;
                    document.getElementById('loginSection').classList.add('hidden');
                    document.getElementById('pdfsSection').classList.remove('hidden');
                    loadPDFs();
                } else {
                    errorDiv.innerHTML = '<div class="error">Email ou mot de passe incorrect</div>';
                }
            } catch (error) {
                errorDiv.innerHTML = '<div class="error">Erreur de connexion</div>';
            }
        }

        async function loadPDFs() {
            const pdfsList = document.getElementById('pdfsList');
            pdfsList.innerHTML = '<div class="loading">⏳ Chargement...</div>';
            
            try {
                const response = await fetch(`${API_URL}/admin/failed-conversions?status=pending&limit=50`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.total === 0) {
                        pdfsList.innerHTML = '<div class="success">✅ Aucun PDF en attente !</div>';
                        return;
                    }
                    
                    pdfsList.innerHTML = data.reports.map(pdf => `
                        <div class="pdf-item">
                            <h3>📄 ${pdf.filename}</h3>
                            <div class="pdf-info">👤 Utilisateur: ${pdf.user_email}</div>
                            <div class="pdf-info">🏦 Banque: ${pdf.bank_name || 'Inconnue'}</div>
                            <div class="pdf-info">📅 Date: ${new Date(pdf.reported_at).toLocaleString('fr-FR')}</div>
                            <div class="pdf-info">❌ Erreur: ${pdf.error_message}</div>
                            <button onclick="downloadPDF(${pdf.id}, '${pdf.filename}')">⬇️ Télécharger</button>
                        </div>
                    `).join('');
                } else {
                    pdfsList.innerHTML = '<div class="error">❌ Erreur lors du chargement</div>';
                }
            } catch (error) {
                pdfsList.innerHTML = '<div class="error">❌ Erreur de connexion</div>';
            }
        }

        async function downloadPDF(id, filename) {
            try {
                const response = await fetch(`${API_URL}/admin/download-failed-pdf/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } else {
                    alert('❌ Erreur lors du téléchargement');
                }
            } catch (error) {
                alert('❌ Erreur de connexion');
            }
        }
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)

# ============================================================================
# STRIPE WEBHOOKS
# ============================================================================

@app.post("/stripe/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Webhook Stripe pour gérer les événements de paiement
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.getenv("STRIPE_WEBHOOK_SECRET")
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    event_type = event["type"]
    
    # NOUVELLE SOUSCRIPTION
    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        customer_email = session.get("customer_email")
        customer_id = session.get("customer")
        
        # Récupérer la subscription pour avoir le plan
        subscription_id = session.get("subscription")
        if subscription_id:
            subscription = stripe.Subscription.retrieve(subscription_id)
            price_id = subscription["items"]["data"]["price"]["id"]
            
            # Mapper les price_id aux plans
            plan_mapping = {
                os.getenv("STRIPE_PRICE_PREMIUM"): "premium",
                os.getenv("STRIPE_PRICE_PRO"): "pro"
            }
            plan = plan_mapping.get(price_id, "free")
            
            logger.info(f"💳 New subscription: {customer_email} -> {plan.upper()}")
            
            # Mettre à jour l'utilisateur
            try:
                user = db.query(User).filter(User.email == customer_email).first()
                if user:
                    user.subscription_tier = plan
                    user.stripe_customer_id = customer_id
                    user.updated_at = datetime.now(timezone.utc)
                    db.commit()
                    logger.info(f"✅ User {customer_email} successfully upgraded to {plan.upper()}")
                else:
                    logger.error(f"❌ User not found: {customer_email}")
            except Exception as e:
                db.rollback()
                logger.error(f"❌ Error updating user {customer_email}: {str(e)}")
    
    # ABONNEMENT MODIFIÉ (changement de plan)
    elif event_type == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription["customer"]
        price_id = subscription["items"]["data"]["price"]["id"]
        
        logger.info(f"🔄 Subscription updated for customer {customer_id} - Price ID: {price_id}")
        
        plan_mapping = {
            os.getenv("STRIPE_PRICE_PREMIUM"): "premium",
            os.getenv("STRIPE_PRICE_PRO"): "pro"
        }
        plan = plan_mapping.get(price_id, "free")
        
        try:
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if user:
                user.subscription_tier = plan
                user.updated_at = datetime.now(timezone.utc)
                db.commit()
                logger.info(f"✅ User {user.email} plan updated to {plan.upper()}")
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error updating subscription: {str(e)}")
    
    # ABONNEMENT ANNULÉ
    elif event_type == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription["customer"]
        
        logger.info(f"❌ Subscription cancelled for customer {customer_id}")
        
        try:
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if user:
                user.subscription_tier = "free"
                user.updated_at = datetime.now(timezone.utc)
                db.commit()
                logger.info(f"✅ User {user.email} downgraded to FREE")
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error downgrading user: {str(e)}")
    
    return {"status": "success"}

# ============================================================================
# DOWNLOAD ENDPOINT
# ============================================================================

@app.get("/download/{upload_id}")
async def download_excel(
    upload_id: str,
    email: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Télécharger le fichier Excel d'un upload précédent"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    upload = db.query(Upload).filter(
        Upload.id == int(upload_id),
        Upload.user_id == user.id
    ).first()
    
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if not upload.excel_data:
        raise HTTPException(status_code=404, detail="Excel file not found")
    
    filename = upload.filename.replace(".pdf", "_EXTRAIT.xlsx")
    
    return Response(
        content=upload.excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/health")
async def health_check():
    """Endpoint de santé pour vérifier que l'API fonctionne"""
    mistral_configured = os.getenv("MISTRAL_API_KEY") is not None
    
    return {
        "status": "ok",
        "version": "2.1.0",
        "debug_mode": DEBUG_MISTRAL,
        "mistral_configured": mistral_configured,
        "mistral_status": "✅ Configured" if mistral_configured else "⚠️ Not configured",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/")
async def root():
    """Page d'accueil de l'API"""
    return {
        "app": "ComptaFlow API",
        "version": "2.1.0",
        "description": "Convertisseur de relevés bancaires PDF en Excel avec Mistral AI",
        "endpoints": {
            "auth": ["/auth/register", "/auth/login", "/me"],
            "upload": ["/upload", "/upload-guest", "/validate-statement"],
            "support": ["/supported-banks", "/support/contact", "/report-failed-conversion"],
            "admin": ["/admin/failed-conversions", "/admin/download-failed-pdf/{id}", "/admin/pdf-downloader"],
            "debug": ["/debug-pdf"],
            "health": ["/health"]
        },
        "features": {
            "ai_extraction": "✅ Mistral AI integration",
            "auto_validation": "✅ Automatic bank detection",
            "discord_notifications": "✅ Discord alerts for unsupported banks",
            "guest_conversions": "✅ Free trial without account",
            "debug_mode": f"{'✅ Enabled' if DEBUG_MISTRAL else '⚠️ Disabled'}"
        }
    }

# ============================================================================
# STARTUP
# ============================================================================

if __name__ == '__main__':
    import uvicorn
    
    # Vérifier la configuration
    if not os.getenv("MISTRAL_API_KEY"):
        logger.warning("⚠️ MISTRAL_API_KEY non configurée ! L'extraction Mistral AI ne fonctionnera pas.")
        logger.warning("   Le système utilisera le fallback regex classique.")
    else:
        logger.info("✅ MISTRAL_API_KEY configurée")
    
    if not os.getenv("DISCORD_WEBHOOK_URL"):
        logger.warning("⚠️ DISCORD_WEBHOOK_URL non configurée (notifications désactivées)")
    
    logger.info("=" * 80)
    logger.info(f"🚀 ComptaFlow Backend v2.1.0")
    logger.info(f"   Mode: {'🐛 DEBUG' if DEBUG_MISTRAL else '🚀 PRODUCTION'}")
    logger.info(f"   Mistral AI: {'✅ Enabled' if os.getenv('MISTRAL_API_KEY') else '⚠️ Disabled (fallback to regex)'}")
    logger.info(f"   Discord: {'✅ Enabled' if os.getenv('DISCORD_WEBHOOK_URL') else '⚠️ Disabled'}")
    logger.info("=" * 80)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        log_level="debug" if DEBUG_MISTRAL else "info"
    )


