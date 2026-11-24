# Journal des versions

## 1.1.4 (versionCode 6)

### Résumé

- Le calendrier du cycle se feuillette au doigt, et chaque jour a sa fiche : douleur, médicaments, humeur.
- Les écrans vides montrent le lys et quoi faire.
- Sous le capot : synchronisation du couple réunie, publication en une seule commande.

### Détails

#### Nouveautés

- Calendrier du cycle : glisser vers la gauche ou la droite pour changer de mois.
- Fiche d'un jour : phase, douleur (modifiable par elle pour un jour passé), médicaments pris ce jour-là, humeur notée ce jour-là.
- États vides (Nos dates, stickers, stockage, médicaments) : le lys, une phrase claire et, quand il y en a une, l'action à faire.

#### Technique

- Dates, cycle et humeur partagés par un module unique (couple/shared.ts), compatible avec les versions précédentes.
- Workflow « Publier Nébula » : compilation, signature, release et notification en une seule commande.

## 1.1.3 (versionCode 5)

### Résumé

- Nouveau dans le suivi du cycle : noter un médicament pris (paracétamol, ibuprofène, Spasfon…).
- Nébula dit quand elle peut en reprendre et l'en prévient, avec « Je l'ai pris » dans la notification.
- Lui voit les prises, sans pouvoir rien modifier.

### Détails

#### Nouveautés

- Médicaments : un appui note la prise ; la dernière prise de chaque médicament indique l'heure à partir de laquelle en reprendre, d'après le délai minimum de la notice.
- Notification au bon moment, avec le bouton « Je l'ai pris » qui note la nouvelle prise sans ouvrir l'app.
- Les prises sont synchronisées avec l'autre téléphone, en lecture seule.

## 1.1.2 (versionCode 4)

### Résumé

- Glisser la lecture d'un vocal est fluide, et ne fait plus répondre ni défiler.
- Une notification quand elle aime un de tes messages.
- La carte se télécharge même quand tu quittes l'app, et sa barre reste.
- Les feuilles du bas se ferment en tirant la poignée, jusqu'en bas de l'écran.

### Détails

#### Nouveautés

- Notification « X a aimé ton message » (ou « a réagi 😂 ») quand l'app n'est pas ouverte.
- Feuilles du bas : la poignée et le titre se tirent vers le bas pour fermer, partout. Toucher à côté ferme aussi.

#### Corrections

- Vocaux : le glisser de lecture garde la main jusqu'au lâcher, même hors de la bulle, sans répondre ni faire défiler la conversation. Zone tactile plus grande, mouvement fluide.
- Carte : le téléchargement continue en changeant d'onglet ou en quittant l'app (notification de progression), reprend tout seul s'il a été coupé, et la barre reste affichée.
- Fermeture du QR code et des grandes feuilles : l'animation va jusqu'en bas de l'écran.

## 1.1.1 (versionCode 3)

### Résumé

- La position « tant que l'app est ouverte » ne s'arrête plus : elle reprend toute seule quand tu reviens.
- Le cycle s'affiche au bon téléphone, sans rien régler.
- Captures d'écran autorisables, et place réelle de l'app dans Stockage.
- Plein de corrections : boutons, clavier, lien de liaison, visionneuse.

### Détails

#### Nouveautés

- Captures d'écran : interrupteur dans Confidentialité. Une capture bloquée propose de les autoriser (Android 14+). Les médias à vue unique restent toujours protégés.
- Stockage : la place totale de l'app (application, cartes hors ligne, cache), comme dans les réglages d'Android.
- Texte et liens partagés vers Nébula envoyés comme message.

#### Corrections

- Position « tant que l'app est ouverte » : plus de « partage terminé » en quittant l'app. L'autre voit « Nébula fermé · position d'il y a … », et tout reprend au retour. Position remesurée pendant le partage.
- Cycle : sur son téléphone à lui, ni bouton ni calendrier vide tant qu'elle n'a rien noté.
- Lien de liaison en nebula:// (il ouvrait Pear), retrouvé même au milieu d'un message copié.
- Sauvegardes nommées Nebula-….nebula (les anciennes .pear se restaurent toujours).
- Répondre ouvre le clavier à chaque fois. Fond noir derrière la saisie, clavier ouvert.
- Grain des boutons sur toute leur largeur, fond de la page de mise à jour à sa place.
- Visionneuse de photo de profil : la croix et le nom ne réapparaissent plus en fermant.
- Création de sticker au style de Nébula, plus de choix de thème clair.

## 1.1.0 (versionCode 2)

### Résumé

- Nouveau : le suivi du cycle, avec calendrier, prévisions et rappels pour vous deux.
- Vos humeurs et la distance entre vous, directement dans l'onglet Nous.
- Toute la France sur la carte, et le détail des rues autour d'elle quand elle partage sa position.
- Les vocaux reçus app fermée s'écoutent enfin, et Pense à toi n'a plus de limite.

### Détails

#### Nouveautés

- Carte Cycle dans Nous : règles notées même en cours, fin, douleur du jour ; calendrier des phases (règles, fenêtre fertile, ovulation) et prévisions sans fin d'après la moyenne des cycles notés.
- Rappels du cycle : deux jours avant pour vous deux ; pour elle, « Tes règles sont arrivées ? » le jour prévu puis « Elles sont terminées ? » ; pour lui, le jour prévu, quand elles commencent et quand elle a mal.
- Carte Humeur : chacun choisit la sienne, l'autre la voit et reçoit une notification.
- Carte Distance quand sa position est partagée en direct.
- Carte : toute la France hors ligne (villes, villages, routes), et le détail rue par rue ajouté tout seul autour de sa position.
- Pense à toi : plus de plafond ; la notification dit combien de fois aujourd'hui et à quelle heure la dernière, et ouvre l'écran Pense à toi.
- Partage vers Nébula de tous les fichiers, depuis la Galerie Samsung comme ailleurs.

#### Corrections

- Un vocal envoyé pendant qu'on n'était pas sur l'app restait « proposé » et s'affichait comme un lecteur vide : il se télécharge maintenant tout seul.
- La reprise d'un fichier interrompu pouvait le rendre illisible ; les téléchargements coupés reprennent à l'ouverture.
- Le lys est centré quand vos deux pouces sont posés.

#### Technique

- Données du cycle et des humeurs chiffrées de bout en bout et synchronisées comme Nos dates (la plus récente gagne).
- Couleurs du cycle dans le thème (fixed.cycle), icônes au trait au lieu d'émojis.

## 1.0.0 (versionCode 1)

### Résumé

- Nébula, rien que pour vous deux : l'onglet Nous, la carte et le profil.
- Pense à toi, pouce contre pouce et vos dates, synchronisés entre vos deux téléphones.
- Les fonds violets à grain, le lys et la barre en verre flouté en direct.

### Détails

#### Nouveautés

- Onglets Nous (le lys), Carte et Profil, aux icônes animées, dans une barre au flou natif en direct.
- Onglet Nous : sa photo et son état, la conversation, Pense à toi, le compte à rebours, les médias partagés.
- Pense à toi et pouce contre pouce ; Nos dates avec compte à rebours et calendrier, synchronisées.
- Prise en main sur mesure, liaison à une seule personne, verrou par empreinte avec le lys.
- Écrans Médias, conversation, carte, profil et réglages d'après les planches Elvira.

#### Technique

- Base de Pear 1.9.1 (connexion directe, chiffrement de bout en bout, même projet Firebase).
