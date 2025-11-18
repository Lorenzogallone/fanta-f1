# 🤖 GitHub Actions Workflows

Questo directory contiene i workflow automatici per il monitoraggio del sistema di notifiche FantaF1.

## 📋 Workflow Disponibili

### 💰 Monthly Cost Check
**File:** `monthly-cost-check.yml`
**Schedule:** 1° di ogni mese alle 10:00 (Italia)

**Funzionalità:**
- Esegue script completo di analisi costi
- Recupera statistiche real-time da Cloud Functions
- Invia email HTML con report dettagliato
- Crea GitHub Issue automaticamente se anomalie

**Output:**
- Email HTML responsive con metriche visive
- Report completo costi e utilizzo
- Link diretti a Firebase Console
- Statistiche JSON complete

---

### 🏥 Weekly Health Check
**File:** `weekly-health-check.yml`
**Schedule:** Ogni lunedì alle 10:00 (Italia)

**Funzionalità:**
- Controllo rapido stato sistema
- Verifica endpoint Cloud Functions
- Alert SOLO se anomalie rilevate
- Notifiche Telegram opzionali

**Anomalie rilevate:**
- \> 100 dispositivi (possibile spam)
- 0 dispositivi (possibile problema)
- Endpoint non risponde

---

## 🚀 Setup Rapido

1. **Crea Gmail App Password**
   - [myaccount.google.com/security](https://myaccount.google.com/security)
   - 2FA → App passwords → Mail
   - Copia password 16 caratteri

2. **Configura GitHub Secrets**
   - Settings → Secrets and variables → Actions
   - Aggiungi:
     - `EMAIL_USERNAME`: tua-email@gmail.com
     - `EMAIL_PASSWORD`: app-password-16-caratteri
     - `EMAIL_TO`: destinatario@email.com

3. **Test Workflow**
   - Actions → Monthly Cost Check → Run workflow
   - Verifica email ricevuta

**Guida completa:** [`/GITHUB_ACTIONS_SETUP.md`](../../GITHUB_ACTIONS_SETUP.md)

---

## 🔧 Personalizzazione

### Cambiare Orario

Modifica il campo `cron`:

```yaml
schedule:
  - cron: '0 9 1 * *'  # Minuto Ora Giorno Mese GiornoSettimana
```

**Tool utile:** [crontab.guru](https://crontab.guru/)

### Aggiungere Slack

Sostituisci email action con:

```yaml
- name: Send Slack
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: '{"text":"Report costi: €0.00 ✅"}'
```

---

## 📊 Monitoring

**Visualizza runs:**
```
GitHub → Actions → Seleziona workflow
```

**Costi GitHub Actions:**
- Monthly: ~2 min/mese
- Weekly: ~4 min/mese
- **Totale: 6 min/mese** (0,3% del limite free 2000 min)

**Costo: €0,00** ✅

---

## 🐛 Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| Email non arriva | Verifica secrets + spam folder |
| Workflow non esegue | Deve essere in branch main/default |
| Errore auth Gmail | Rigenera App Password |
| Endpoint non risponde | Verifica functions deployate |

**Guida completa troubleshooting:** [`/GITHUB_ACTIONS_SETUP.md`](../../GITHUB_ACTIONS_SETUP.md#-troubleshooting)

---

## 📚 Documentazione

- **Setup Completo:** [`/GITHUB_ACTIONS_SETUP.md`](../../GITHUB_ACTIONS_SETUP.md)
- **Analisi Costi:** [`/COST_ANALYSIS.md`](../../COST_ANALYSIS.md)
- **Script Monitoring:** [`/check-costs.sh`](../../check-costs.sh)

---

## ✅ Status

| Workflow | Status | Ultima Esecuzione |
|----------|--------|-------------------|
| Monthly Cost Check | [![Monthly](https://github.com/Lorenzogallone/fanta-f1/actions/workflows/monthly-cost-check.yml/badge.svg)](https://github.com/Lorenzogallone/fanta-f1/actions/workflows/monthly-cost-check.yml) | Vedi Actions |
| Weekly Health Check | [![Weekly](https://github.com/Lorenzogallone/fanta-f1/actions/workflows/weekly-health-check.yml/badge.svg)](https://github.com/Lorenzogallone/fanta-f1/actions/workflows/weekly-health-check.yml) | Vedi Actions |

---

**Ultimo aggiornamento:** Novembre 2025
