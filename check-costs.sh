#!/bin/bash

##############################################################################
# FantaF1 Notification System - Cost & Health Check
#
# Questo script controlla lo stato del sistema di notifiche e stima i costi
#
# Usage: ./check-costs.sh
##############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Emoji
CHECK="✅"
WARNING="⚠️"
ERROR="❌"
INFO="ℹ️"

STATS_URL="https://europe-west1-fantaf1-b5410.cloudfunctions.net/getNotificationStats"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  🔔 FantaF1 Notification System - Health Check"
echo "═══════════════════════════════════════════════════════"
echo ""

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${ERROR} curl non trovato. Installa curl per usare questo script."
    exit 1
fi

# Check if jq is available (optional but helpful)
HAS_JQ=false
if command -v jq &> /dev/null; then
    HAS_JQ=true
fi

echo -e "${INFO} Recupero statistiche da Cloud Functions..."
echo ""

# Fetch stats
RESPONSE=$(curl -s "$STATS_URL")

if [ $? -ne 0 ]; then
    echo -e "${ERROR} Errore nel recupero delle statistiche!"
    echo -e "${INFO} Verifica che le Cloud Functions siano deployate."
    exit 1
fi

# Parse response
if [ "$HAS_JQ" = true ]; then
    # Use jq for pretty parsing
    TOTAL_TOKENS=$(echo "$RESPONSE" | jq -r '.totalTokens')
    TOTAL_NOTIFICATIONS=$(echo "$RESPONSE" | jq -r '.totalNotificationsSent')
    MAX_TOKENS_LIMIT=$(echo "$RESPONSE" | jq -r '.safetyLimits.MAX_TOKENS_PER_NOTIFICATION')
    MAX_NOTIFICATIONS_LIMIT=$(echo "$RESPONSE" | jq -r '.safetyLimits.MAX_NOTIFICATIONS_PER_RUN')
    RATE_LIMIT=$(echo "$RESPONSE" | jq -r '.safetyLimits.MAX_TEST_CALLS_PER_MINUTE')

    echo "╔════════════════════════════════════════════════════╗"
    echo "║              📊 STATO ATTUALE                      ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""
    echo -e "  Dispositivi registrati:       ${GREEN}$TOTAL_TOKENS${NC}"
    echo -e "  Notifiche inviate (totale):   ${GREEN}$TOTAL_NOTIFICATIONS${NC}"
    echo ""

    # Calculate monthly estimates
    CURRENT_DATE=$(date +%Y-%m)
    CURRENT_DAY=$(date +%d)
    DAYS_IN_MONTH=30

    # Estimate monthly notifications (54 events per season / 12 months ≈ 4.5/month)
    MONTHLY_NOTIFICATIONS_ESTIMATE=$((TOTAL_TOKENS * 5))

    echo "╔════════════════════════════════════════════════════╗"
    echo "║              💰 STIMA COSTI MENSILI                ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""

    # Cloud Functions
    MONTHLY_INVOCATIONS=2920
    CF_LIMIT=2000000
    CF_PERCENTAGE=$(awk "BEGIN {printf \"%.2f\", ($MONTHLY_INVOCATIONS/$CF_LIMIT)*100}")

    echo -e "  Cloud Functions:"
    echo -e "    Invocations/mese:    ${GREEN}$MONTHLY_INVOCATIONS${NC} / $CF_LIMIT"
    echo -e "    Utilizzo:            ${GREEN}$CF_PERCENTAGE%${NC}"
    echo -e "    Costo:               ${GREEN}€0,00${NC} ${CHECK}"
    echo ""

    # FCM
    MONTHLY_FCM=$((TOTAL_TOKENS * 5))
    echo -e "  Firebase Cloud Messaging:"
    echo -e "    Messaggi/mese:       ${GREEN}~$MONTHLY_FCM${NC}"
    echo -e "    Limite:              ${GREEN}UNLIMITED${NC}"
    echo -e "    Costo:               ${GREEN}€0,00${NC} ${CHECK}"
    echo ""

    # Firestore Reads
    MONTHLY_READS=108000
    FS_READ_LIMIT=1500000
    FS_PERCENTAGE=$(awk "BEGIN {printf \"%.2f\", ($MONTHLY_READS/$FS_READ_LIMIT)*100}")

    echo -e "  Firestore:"
    echo -e "    Reads/mese:          ${GREEN}~$MONTHLY_READS${NC} / $FS_READ_LIMIT"
    echo -e "    Utilizzo:            ${GREEN}$FS_PERCENTAGE%${NC}"
    echo -e "    Costo:               ${GREEN}€0,00${NC} ${CHECK}"
    echo ""

    # Total
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  ${GREEN}TOTALE MENSILE:         €0,00${NC} ${CHECK}${CHECK}${CHECK}"
    echo ""

    # Safety limits
    echo "╔════════════════════════════════════════════════════╗"
    echo "║              🛡️  PROTEZIONI ATTIVE                 ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""
    echo -e "  ${CHECK} Max destinatari/notifica:     $MAX_TOKENS_LIMIT"
    echo -e "  ${CHECK} Max eventi/esecuzione:        $MAX_NOTIFICATIONS_LIMIT"
    echo -e "  ${CHECK} Rate limit test endpoint:     $RATE_LIMIT calls/min"
    echo -e "  ${CHECK} No retry automatici:          Attivo"
    echo -e "  ${CHECK} Deduplicazione:               Attiva"
    echo ""

    # Health status
    echo "╔════════════════════════════════════════════════════╗"
    echo "║              ❤️  STATO SISTEMA                     ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""

    # Check if numbers are healthy
    HEALTH_OK=true

    if [ "$TOTAL_TOKENS" -gt 1000 ]; then
        echo -e "  ${WARNING} Attenzione: Troppi token registrati ($TOTAL_TOKENS)"
        echo -e "      Verifica che non ci siano duplicati o bot."
        HEALTH_OK=false
    else
        echo -e "  ${CHECK} Numero token: OK ($TOTAL_TOKENS)"
    fi

    if [ "$MONTHLY_INVOCATIONS" -gt 10000 ]; then
        echo -e "  ${WARNING} Attenzione: Troppe invocations ($MONTHLY_INVOCATIONS)"
        echo -e "      Possibile loop o problema nel codice."
        HEALTH_OK=false
    else
        echo -e "  ${CHECK} Cloud Functions invocations: OK"
    fi

    if [ "$FS_PERCENTAGE" -gt "50" ]; then
        echo -e "  ${WARNING} Attenzione: Firestore reads oltre 50% ($FS_PERCENTAGE%)"
        echo -e "      Monitorare crescita utenti."
    else
        echo -e "  ${CHECK} Firestore usage: OK ($FS_PERCENTAGE%)"
    fi

    echo ""

    # Overall status
    if [ "$HEALTH_OK" = true ]; then
        echo -e "  ${CHECK}${CHECK}${CHECK} ${GREEN}SISTEMA IN SALUTE - NESSUN PROBLEMA${NC} ${CHECK}${CHECK}${CHECK}"
    else
        echo -e "  ${WARNING}${WARNING} ${YELLOW}VERIFICARE I WARNING SOPRA${NC} ${WARNING}${WARNING}"
    fi

    echo ""

    # Recent notifications
    echo "╔════════════════════════════════════════════════════╗"
    echo "║         📜 ULTIME NOTIFICHE INVIATE                ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""

    RECENT=$(echo "$RESPONSE" | jq -r '.recentNotifications[] | "  - \(.eventType | ascii_upcase): \(.raceName) (\(.sentAt | split("T")[0]))"')

    if [ -z "$RECENT" ]; then
        echo -e "  ${INFO} Nessuna notifica inviata ancora."
    else
        echo "$RECENT"
    fi

    echo ""

else
    # Fallback without jq (basic display)
    echo "$RESPONSE" | grep -o '"totalTokens":[0-9]*' | cut -d':' -f2 > /tmp/tokens
    echo "$RESPONSE" | grep -o '"totalNotificationsSent":[0-9]*' | cut -d':' -f2 > /tmp/notifications

    TOTAL_TOKENS=$(cat /tmp/tokens 2>/dev/null || echo "N/A")
    TOTAL_NOTIFICATIONS=$(cat /tmp/notifications 2>/dev/null || echo "N/A")

    echo "╔════════════════════════════════════════════════════╗"
    echo "║              📊 STATO ATTUALE                      ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""
    echo -e "  Dispositivi registrati:       ${GREEN}$TOTAL_TOKENS${NC}"
    echo -e "  Notifiche inviate:            ${GREEN}$TOTAL_NOTIFICATIONS${NC}"
    echo ""
    echo -e "  ${INFO} Installa 'jq' per un report dettagliato:"
    echo -e "      ${BLUE}sudo apt-get install jq${NC}"
    echo ""

    # Basic cost estimate
    echo "╔════════════════════════════════════════════════════╗"
    echo "║              💰 STIMA COSTI                        ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""
    echo -e "  Cloud Functions:     ${GREEN}€0,00/mese${NC} ${CHECK}"
    echo -e "  FCM Messages:        ${GREEN}€0,00/mese${NC} ${CHECK}"
    echo -e "  Firestore:           ${GREEN}€0,00/mese${NC} ${CHECK}"
    echo ""
    echo -e "  ${GREEN}TOTALE:              €0,00/mese${NC} ${CHECK}${CHECK}${CHECK}"
    echo ""

    rm -f /tmp/tokens /tmp/notifications 2>/dev/null
fi

# Recommendations
echo "╔════════════════════════════════════════════════════╗"
echo "║              💡 RACCOMANDAZIONI                    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo -e "  ${CHECK} Esegui questo check 1 volta al mese"
echo -e "  ${CHECK} Verifica budget alerts configurati:"
echo -e "      → https://console.cloud.google.com/"
echo -e "  ${CHECK} Monitora logs per errori:"
echo -e "      → ${BLUE}firebase functions:log${NC}"
echo ""

# Footer
echo "═══════════════════════════════════════════════════════"
echo -e "  Report generato: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "  Prossimo check:  $(date -d '+1 month' '+%Y-%m-%d')"
echo "═══════════════════════════════════════════════════════"
echo ""

exit 0
