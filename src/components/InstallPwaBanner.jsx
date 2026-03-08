import React, { useState, useEffect, useContext } from 'react';
import { Toast, Button } from 'react-bootstrap';
import { LanguageContext } from './../contexts/LanguageContext';

const GetAppIcon = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
  </svg>
);
const IosShareIcon = ({ fontSize, className }) => (
  <svg className={className} width={fontSize === 'small' ? 20 : 24} height={fontSize === 'small' ? 20 : 24} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V10c0-1.1.9-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .9 2 2z"/>
  </svg>
);
const AddBoxIcon = ({ fontSize, className }) => (
  <svg className={className} width={fontSize === 'small' ? 20 : 24} height={fontSize === 'small' ? 20 : 24} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
  </svg>
);

export const InstallPwaBanner = () => {
  const [show, setShow] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const { t } = useContext(LanguageContext);

  useEffect(() => {
    // Controlla se l'utente ha già chiuso il banner in passato
    const bannerDismissed = localStorage.getItem('fanta-f1-pwa-dismissed');
    if (bannerDismissed === 'true') {
      return;
    }

    // 1. Logica Android (Chrome, Edge, ecc.)
    const handleBeforeInstallPrompt = (e) => {
      // Previene il mini-infobar default di Chrome sulle versioni vecchie
      e.preventDefault();
      // Salva l'evento così possiamo attivarlo in seguito col pulsante
      setInstallPromptEvent(e);
      // Mostra il nostro Toast/Banner custom
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 2. Logica iOS (Safari)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIphoneOrIpad = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios/.test(userAgent);
    
    // Controlla se è già in modalità standalone (PWA installata)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || document.referrer.includes('android-app://');

    if (isIphoneOrIpad && isSafari && !isStandalone) {
      setIsIOS(true);
      setShow(true);
    }

    // Pulisci i listener
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;

    // Mostra il prompt nativo di installazione
    installPromptEvent.prompt();

    // Aspetta la scelta dell'utente
    const { outcome } = await installPromptEvent.userChoice;
    
    if (outcome === 'accepted') {
      console.log("Install prompt accepted");
      setShow(false); // Nascondi il banner se accetta
    } else {
      console.log("Install prompt dismissed");
    }

    // L'evento prompt non può essere usato due volte, quindi lo resettiamo
    setInstallPromptEvent(null);
  };

  const handleDismiss = () => {
    // Salva nel localStorage che l'utente non vuole più vedere il banner
    localStorage.setItem('fanta-f1-pwa-dismissed', 'true');
    setShow(false);
  };

  // Niente da mostrare
  if (!show) return null;

  return (
    <div className="position-fixed bottom-0 start-50 translate-middle-x p-3" style={{ zIndex: 1100, width: '100%', maxWidth: '400px' }}>
      <Toast show={show} onClose={handleDismiss} delay={15000} className="w-100 shadow-lg border-danger">
        <Toast.Header closeButton={true}>
          <GetAppIcon className="text-danger me-2" />
          <strong className="me-auto">{t('pwa.installTitle')}</strong>
          <small className="text-muted d-flex align-items-center">
            <span className="me-2 cursor-pointer" onClick={handleDismiss} style={{ cursor: 'pointer' }}>{t('pwa.close')}</span>
          </small>
        </Toast.Header>
        <Toast.Body className="bg-body">
          {isIOS ? (
            <div>
              <p className="mb-3 fw-medium">{t('pwa.installIosMessage')}</p>
              
              <div className="d-flex align-items-center mb-2 small bg-body-tertiary p-2 rounded border">
                <span className="fw-bold me-2">1.</span>
                <span>{t('pwa.installIosStep1')}</span> 
                <IosShareIcon fontSize="small" className="ms-auto text-primary" />
              </div>
              
              <div className="d-flex align-items-center small bg-body-tertiary p-2 rounded border">
                <span className="fw-bold me-2">2.</span>
                <span>{t('pwa.installIosStep2')}</span>
                <AddBoxIcon fontSize="small" className="ms-auto text-secondary" />
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-3 fw-medium">{t('pwa.installAndroidMessage')}</p>
              <div className="d-flex justify-content-end">
                <Button variant="danger" size="sm" onClick={handleInstallClick}>
                  {t('pwa.installNow')}
                </Button>
              </div>
            </div>
          )}
        </Toast.Body>
      </Toast>
    </div>
  );
};

export default InstallPwaBanner;
