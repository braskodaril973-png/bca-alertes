# BCA Alertes — appli téléphone de la veille BénefClicAuto (V0.23.0)

Appli web installable (PWA) pour **Chrome sur Android**. Elle reçoit les alertes de la veille BénefClicAuto, même téléphone verrouillé. Elle affiche les lots (photo, enchère, plafond BCA, bénéfice estimé, CT, compte à rebours, lien vers la fiche) et le **dernier signal du PC** : un bandeau rouge apparaît au-delà de 26 h sans nouvelles.

**Aucun serveur de données.** C'est l'extension qui envoie elle-même chaque notification au service push de Google, chiffrée pour ce téléphone seul. L'hébergement ne sert qu'à distribuer ces fichiers statiques. Les lots reçus restent sur le téléphone.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `app.css`, `app.js` | Page de l'appli : mise en route, liste des lots, messages |
| `sw.js` | Service worker : réception des notifications, affichage, ouverture du lot au clic, fonctionnement hors ligne |
| `db.js` | Base locale du téléphone (IndexedDB) |
| `manifest.webmanifest`, `icon-192.png`, `icon-512.png` | Installation sur l'écran d'accueil |

## 1. Héberger l'appli (une fois, gratuit)

L'appli doit être servie en **https**. Au choix :

- **GitHub Pages** : crée un dépôt (par exemple `bca-alertes`) et déposes-y le **contenu** de ce dossier. Ensuite, *Settings → Pages → Deploy from a branch → main / root*. L'adresse ressemble à `https://<ton-compte>.github.io/bca-alertes/`.
- **Cloudflare Pages** : *Workers & Pages → Create → Pages → Upload assets*, puis glisse ce dossier. L'adresse ressemble à `https://bca-alertes.pages.dev/`.

Il n'y a rien à configurer côté hébergeur : ce sont des fichiers statiques.

## 2. Appairer le téléphone (une fois)

1. Dans BénefClicAuto, ouvre **Réglages de la veille → Téléphone** :
   - colle l'**adresse de l'appli** (étape 1) ;
   - clique **« Envoyer le lien sur Telegram »** (ou copie le lien).
2. Sur le téléphone, ouvre ce lien **dans Chrome**. Le lien contient la clé publique de ta veille, dans la partie après `#`, qui n'est jamais envoyée à l'hébergeur.
3. Installe l'appli (bouton **Installer**, ou menu ⋮ → *Installer l'application*), puis ouvre-la depuis l'écran d'accueil.
4. Touche **« Activer les alertes »** et autorise les notifications.
5. L'appli affiche un **code d'appairage** (`BCA1.…`). Touche **Partager** et envoie-le-toi (Telegram, mail), puis colle-le dans BénefClicAuto → Réglages de la veille → **« Appairer le téléphone »**.
6. Une notification « ✅ Téléphone appairé » arrive sur le téléphone. C'est prêt.

Si le téléphone se désabonne (appli désinstallée, données effacées), la veille s'en aperçoit au premier envoi refusé. Elle te prévient alors sur Chrome et Telegram, avec le message « Réappaire le téléphone ».

## Mettre à jour l'appli

Remplace les fichiers chez l'hébergeur. Le téléphone prend la nouvelle version à la prochaine ouverture de l'appli, sans nouvel appairage.
