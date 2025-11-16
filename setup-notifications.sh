#!/bin/bash

# 🔔 Setup Script per Notifiche Push - FantaF1
# Questo script ti guida nel setup delle notifiche

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   🔔 Setup Notifiche Push - FantaF1"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "✅ File .env trovato"
else
    echo "📝 Creo file .env da .env.example..."
    cp .env.example .env
    echo "✅ File .env creato!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   STEP 1: VAPID Key"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Per ottenere la VAPID Key:"
echo "1. Vai su https://console.firebase.google.com/"
echo "2. Seleziona progetto 'fantaf1-b5410'"
echo "3. Settings (⚙️) → Cloud Messaging → Web Push certificates"
echo "4. Clicca 'Generate key pair'"
echo "5. Copia la chiave generata"
echo ""
read -p "Hai già la VAPID Key? (y/n): " has_vapid

if [ "$has_vapid" = "y" ]; then
    read -p "Incolla la VAPID Key: " vapid_key

    # Add to .env
    if grep -q "VITE_FIREBASE_VAPID_KEY=" .env; then
        # Replace existing
        sed -i.bak "s|VITE_FIREBASE_VAPID_KEY=.*|VITE_FIREBASE_VAPID_KEY=$vapid_key|" .env
        rm -f .env.bak
    else
        # Add new
        echo "VITE_FIREBASE_VAPID_KEY=$vapid_key" >> .env
    fi

    echo "✅ VAPID Key salvata in .env"
else
    echo "⚠️  Ottieni prima la VAPID Key e poi riesegui questo script"
    echo "    Oppure aggiungi manualmente in .env:"
    echo "    VITE_FIREBASE_VAPID_KEY=LA_TUA_KEY"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   STEP 2: URL App"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Qual è l'URL della tua app deployata?"
echo "Esempio: https://fantaf1-b5410.web.app"
echo ""
read -p "URL app: " app_url

# Update functions/index.js
if [ -f functions/index.js ]; then
    echo "📝 Aggiorno functions/index.js..."
    sed -i.bak "s|link: 'https://your-app-url.com/lineup'|link: '$app_url/lineup'|" functions/index.js
    rm -f functions/index.js.bak
    echo "✅ URL aggiornato in functions/index.js"
else
    echo "⚠️  File functions/index.js non trovato"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   STEP 3: Installazione Dipendenze"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -d functions/node_modules ]; then
    echo "✅ Dipendenze già installate in functions/"
else
    echo "📦 Installo dipendenze Cloud Functions..."
    cd functions
    npm install
    cd ..
    echo "✅ Dipendenze installate!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   STEP 4: Deploy Cloud Functions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Vuoi fare il deploy delle Cloud Functions ora? (y/n): " deploy_now

if [ "$deploy_now" = "y" ]; then
    echo "🚀 Deploy in corso..."
    firebase deploy --only functions
    echo "✅ Deploy completato!"
else
    echo "⚠️  Ricorda di fare il deploy più tardi con:"
    echo "    firebase deploy --only functions"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   ✅ SETUP COMPLETATO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Prossimi passi:"
echo "1. Riavvia il dev server: npm run dev"
echo "2. Integra NotificationSettings component nell'app"
echo "3. Testa le notifiche!"
echo ""
echo "📚 Documentazione:"
echo "   - QUICK_START_NOTIFICATIONS.md (guida veloce)"
echo "   - NOTIFICATIONS_SETUP.md (guida completa)"
echo "   - NOTIFICATIONS_INTEGRATION_EXAMPLE.md (esempi codice)"
echo ""
echo "🎉 Notifiche pronte! Buon lavoro!"
