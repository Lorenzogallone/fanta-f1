# 🤖 Setup GitHub Actions per Monitoring Automatico

## 📋 Panoramica

Questo progetto include **2 workflow automatici** per monitorare i costi e lo stato del sistema di notifiche:

1. **💰 Monthly Cost Check** - Report mensile completo via email
2. **🏥 Weekly Health Check** - Controllo settimanale rapido con alert solo se anomalie

---

## 🚀 Quick Setup (5 minuti)

### Step 1: Crea App Password Gmail

Le GitHub Actions inviano email usando Gmail. Devi creare una **App Password**:

1. Vai su [myaccount.google.com/security](https://myaccount.google.com/security)
2. Abilita **2-Step Verification** (se non già attivo)
3. Vai su **App passwords**
4. Seleziona:
   - App: **Mail**
   - Device: **Other (Custom name)** → "FantaF1 GitHub Actions"
5. Clicca **Generate**
6. **Copia la password di 16 caratteri** (es. `abcd efgh ijkl mnop`)

**⚠️ IMPORTANTE:** Questa password la usi SOLO per GitHub Actions, non è la tua password Gmail normale.

---

### Step 2: Configura GitHub Secrets

1. Vai su GitHub: https://github.com/Lorenzogallone/fanta-f1
2. Clicca su **Settings** (in alto a destra)
3. Nel menu laterale: **Secrets and variables → Actions**
4. Clicca **New repository secret**

Crea questi 3 secrets:

#### Secret 1: `EMAIL_USERNAME`
```
Nome: EMAIL_USERNAME
Valore: tua-email@gmail.com
```

#### Secret 2: `EMAIL_PASSWORD`
```
Nome: EMAIL_PASSWORD
Valore: abcd efgh ijkl mnop  (la App Password di 16 caratteri)
```

#### Secret 3: `EMAIL_TO`
```
Nome: EMAIL_TO
Valore: tua-email@gmail.com  (dove vuoi ricevere i report)
```

**Nota:** `EMAIL_TO` può essere diverso da `EMAIL_USERNAME` se vuoi inviare a un'altra email.

---

### Step 3: (Opzionale) Telegram Notifications

Se vuoi ricevere anche notifiche Telegram:

#### 3.1 Crea Bot Telegram

1. Apri Telegram e cerca **@BotFather**
2. Invia `/newbot`
3. Segui istruzioni (nome bot, username)
4. BotFather ti darà un **token** (es. `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. **Copia il token**

#### 3.2 Ottieni Chat ID

1. Cerca il tuo bot su Telegram
2. Invia `/start` al bot
3. Apri nel browser:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   Sostituisci `<YOUR_BOT_TOKEN>` con il token del passo precedente
4. Cerca `"chat":{"id":123456789` e copia il numero (es. `123456789`)

#### 3.3 Aggiungi Secrets su GitHub

```
Nome: TELEGRAM_BOT_TOKEN
Valore: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz

Nome: TELEGRAM_CHAT_ID
Valore: 123456789
```

---

### Step 4: Test Workflow

Testa subito il workflow manualmente:

1. Vai su GitHub: **Actions** tab
2. Seleziona **💰 Monthly Cost Check** nella sidebar
3. Clicca **Run workflow** → **Run workflow**
4. Attendi 1-2 minuti
5. Dovresti ricevere un'email con il report!

Ripeti per **🏥 Weekly Health Check**.

---

## 📅 Scheduling

### Monthly Cost Check

```yaml
Schedule: 1° di ogni mese alle 09:00 UTC (10:00 Italia)
Cron: '0 9 1 * *'
```

**Cosa fa:**
- ✅ Esegue lo script `check-costs.sh`
- ✅ Recupera statistiche da Cloud Functions
- ✅ Invia email HTML con report completo
- ✅ Crea GitHub Issue se rileva anomalie

**Email include:**
- Numero dispositivi registrati
- Notifiche inviate (totale)
- Costo mensile stimato (€0.00)
- Report dettagliato dello script
- Statistiche JSON complete
- Link a Firebase Console e Cloud Billing

### Weekly Health Check

```yaml
Schedule: Ogni lunedì alle 09:00 UTC (10:00 Italia)
Cron: '0 9 * * 1'
```

**Cosa fa:**
- ✅ Controlla che le Cloud Functions rispondano
- ✅ Verifica numero token (atteso ~25)
- ✅ Invia email/Telegram SOLO se anomalie
- ⚠️ Nessuna email se tutto ok (per non spammare)

**Anomalie rilevate:**
- Più di 100 dispositivi registrati (possibile spam)
- 0 dispositivi (possibile problema)
- Endpoint non risponde

---

## 📧 Formato Email

### Email HTML (Monthly)

Il report mensile è in **HTML responsive** con:

- 🎨 **Design professionale** con gradiente
- 📊 **Metriche visive** (dispositivi, notifiche)
- ✅ **Badge di stato** (operativo, €0.00)
- 📈 **Grafici utilizzo** percentuale limiti
- 🛡️ **Lista protezioni** attive
- 📋 **Report completo** in formato pre
- 🔗 **Link diretti** a Firebase e Cloud Console

### Email Testo (Weekly Alert)

Il check settimanale invia email **solo se anomalie** in formato testo semplice.

---

## 🔧 Personalizzazione

### Cambiare Frequenza

Modifica i file `.github/workflows/*.yml`:

**Ogni settimana invece che ogni mese:**
```yaml
schedule:
  - cron: '0 9 * * 1'  # Ogni lunedì
```

**Ogni giorno:**
```yaml
schedule:
  - cron: '0 9 * * *'  # Ogni giorno alle 9:00
```

**2 volte al mese:**
```yaml
schedule:
  - cron: '0 9 1,15 * *'  # 1° e 15 del mese
```

**Cron syntax:** https://crontab.guru/

### Cambiare Soglie di Alert

Modifica `weekly-health-check.yml` linea 46:

```yaml
# Attuale: alert se > 100 token
if [ "$TOKENS" -gt 100 ]; then

# Cambia in 50:
if [ "$TOKENS" -gt 50 ]; then
```

### Aggiungere Slack Notifications

Sostituisci l'azione email con:

```yaml
- name: Send Slack notification
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "💰 FantaF1 Monthly Report",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Dispositivi:* ${{ steps.stats.outputs.TOTAL_TOKENS }}\n*Costo:* €0.00 ✅"
            }
          }
        ]
      }
```

Aggiungi secret `SLACK_WEBHOOK_URL` su GitHub.

---

## 🐛 Troubleshooting

### Email non arrivano

**Problema: Workflow eseguito ma nessuna email**

**Soluzioni:**

1. **Verifica secrets:**
   ```
   GitHub → Settings → Secrets and variables → Actions
   - EMAIL_USERNAME: ✅ presente?
   - EMAIL_PASSWORD: ✅ presente?
   - EMAIL_TO: ✅ presente?
   ```

2. **Controlla spam folder** della tua email

3. **Verifica App Password Gmail:**
   - È di 16 caratteri senza spazi?
   - L'account ha 2FA abilitato?

4. **Check workflow logs:**
   ```
   GitHub → Actions → Seleziona run → Espandi "Send email report"
   ```
   Cerca errori tipo:
   - `Authentication failed` → Password sbagliata
   - `Invalid credentials` → Username sbagliato
   - `Connection refused` → Firewall/proxy

5. **Test manuale con curl:**
   ```bash
   curl -v smtps://smtp.gmail.com:587 \
     --mail-from "tua-email@gmail.com" \
     --mail-rcpt "tua-email@gmail.com" \
     --user "tua-email@gmail.com:abcd-efgh-ijkl-mnop"
   ```

### Workflow non si esegue automaticamente

**Problema: Passato il 1° del mese ma nessun run**

**Soluzioni:**

1. **Verifica che i workflow siano abilitati:**
   ```
   GitHub → Actions → Verifica messaggio verde in alto
   ```

2. **Repository privata:**
   - GitHub Actions è abilitato per repo private?
   - Hai minuti Actions disponibili? (GitHub free: 2000 min/mese)

3. **Branch corretta:**
   - I workflow devono essere nel branch **main** o **default**
   - Se sono in branch diverso, non si eseguono

4. **Syntax error nel YAML:**
   ```
   GitHub → Actions → Cerca "Invalid workflow file"
   ```

5. **Fuso orario:**
   - Cron usa UTC, non ora italiana
   - 09:00 UTC = 10:00 Italia (inverno) o 11:00 (estate)

### Telegram non funziona

**Problema: Email arrivano ma Telegram no**

**Soluzioni:**

1. **Secrets configurati?**
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`

2. **Test bot manualmente:**
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=Test"
   ```

3. **Hai fatto `/start` al bot?**
   - Il bot può inviare solo a chi ha fatto /start

4. **Chat ID corretto?**
   - Ricontrolla con getUpdates

### Cloud Functions endpoint non risponde

**Problema: `curl: (6) Could not resolve host`**

**Soluzioni:**

1. **Funzioni deployate?**
   ```bash
   firebase deploy --only functions
   ```

2. **URL corretto?**
   ```
   https://europe-west1-fantaf1-b5410.cloudfunctions.net/getNotificationStats
   ```

3. **Funzione pubblica?**
   - `getNotificationStats` deve essere pubblica (nessun auth)

4. **Test manuale:**
   ```bash
   curl -v https://europe-west1-fantaf1-b5410.cloudfunctions.net/getNotificationStats
   ```

---

## 📊 Monitorare le GitHub Actions

### Visualizzare History

```
GitHub → Actions → Seleziona workflow → Vedi tutti i run
```

Ogni run mostra:
- ✅ Successo (verde)
- ❌ Fallito (rosso)
- ⚠️ Cancellato (giallo)
- Durata esecuzione
- Logs completi

### Costi GitHub Actions

**GitHub Free (account personale):**
- ✅ 2.000 minuti/mese gratis
- ✅ Unlimited per repo pubbliche

**Nostro utilizzo:**
- Monthly check: ~2 minuti/mese
- Weekly check: ~1 minuto × 4 = 4 minuti/mese
- **TOTALE: 6 minuti/mese** (0,3% del limite)

**Costo GitHub Actions: €0,00** ✅

### Disabilitare Workflow Temporaneamente

Se vuoi fermare i workflow:

1. Vai su `.github/workflows/monthly-cost-check.yml`
2. Clicca **Edit** (matita)
3. Commenta la sezione `schedule`:
   ```yaml
   #schedule:
   #  - cron: '0 9 1 * *'
   ```
4. Commit → Push

Oppure:

```
GitHub → Actions → Seleziona workflow → ⋯ (3 dots) → Disable workflow
```

---

## 🎯 Best Practices

### 1. Test Iniziale

Prima di affidarti agli automatismi:

```bash
# Esegui manualmente 2-3 volte per verificare
GitHub → Actions → Run workflow (button)

# Verifica email arrivino sempre
# Controlla che i dati siano corretti
```

### 2. Monitoring dei Workflow

Imposta **GitHub notifications** per workflow falliti:

```
GitHub → Settings → Notifications → Actions
✅ Send notifications for failed workflows
```

Riceverai email se un workflow crasha.

### 3. Backup dei Secrets

**⚠️ NON puoi rileggere i secrets dopo averli salvati!**

Salva in modo sicuro (es. password manager):
- Gmail App Password
- Telegram Bot Token
- Telegram Chat ID

### 4. Rotazione Password

Ogni 6-12 mesi:
1. Genera nuova Gmail App Password
2. Aggiorna secret `EMAIL_PASSWORD` su GitHub
3. Revoca vecchia password su Google

### 5. Privacy

**Secrets NON appaiono nei logs!**

GitHub nasconde automaticamente i secrets nei log output:
```
Email sent to ***@gmail.com  ← nascosto!
Token: *** ← nascosto!
```

---

## 📚 Risorse

- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **Cron Syntax:** https://crontab.guru/
- **Send Mail Action:** https://github.com/dawidd6/action-send-mail
- **Gmail App Passwords:** https://support.google.com/accounts/answer/185833

---

## ✅ Checklist Setup Completo

Prima di considerare il setup completato:

- [ ] Gmail App Password creata
- [ ] 3 secrets configurati su GitHub (`EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_TO`)
- [ ] Workflow testato manualmente (Run workflow)
- [ ] Email di test ricevuta correttamente
- [ ] (Opzionale) Telegram configurato e testato
- [ ] GitHub notifications abilitate per workflow falliti
- [ ] Secrets salvati in password manager
- [ ] Workflow schedulati verificati (prossima esecuzione)

---

## 🎉 Conclusione

Una volta configurato:

✅ **Report mensile automatico** via email (1° del mese)
✅ **Check settimanale** con alert solo se problemi
✅ **Zero manutenzione** necessaria
✅ **Sempre informato** sullo stato del sistema
✅ **Protezione automatica** da anomalie

**Set it and forget it!** 🚀

---

**Prossimi passi:**
1. Configura secrets (5 minuti)
2. Testa workflow (2 minuti)
3. Aspetta il 1° del mese per il primo report automatico! 📧

**Problemi?** Consulta la sezione Troubleshooting sopra.

---

**Ultimo aggiornamento:** Novembre 2025
