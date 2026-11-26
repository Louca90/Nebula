# Journal des versions

## 1.1.8 (versionCode 10)

### Résumé

- Les confirmations de réception partent tout de suite, même téléphone verrouillé : un message ne reste plus en « Envoi… » alors qu'il est arrivé.
- La connexion directe ne se coupe plus toutes les 16 secondes quand l'un des deux téléphones est en veille.

### Détails

#### Corrections

- Cause trouvée dans les journaux des deux téléphones : écran éteint, React Native arrête ses minuteurs (setTimeout) tant que l'app n'est pas à l'écran. La confirmation de réception, envoyée 300 ms après le message, attendait donc que le téléphone se rallume ; les confirmations arrivaient par paquets de 10 à 20 au déverrouillage. Elles passent maintenant par une attente native Android, qui tourne écran éteint.
- Même correction pour le battement de cœur de la connexion directe (l'autre téléphone coupait la connexion toutes les 16 s), la fin d'envoi après avoir quitté l'app (elle restait bloquée jusqu'à la réouverture), le réveil par push et l'envoi d'un fichier en arrière-plan.

## 1.1.7 (versionCode 9)

### Résumé

- Un message n'affiche plus « ton contact n'a pas de connexion » à tort : sans confirmation, il dit « Envoyé · pas encore reçu ».
- Un message resté sans confirmation repart tout seul au retour dans l'app, puis toutes les 2 minutes.

### Détails

#### Corrections

- Confirmation de réception perdue : elle voyage en priorité normale (1.1.6), et Android la jette quand l'app de l'expéditeur dort. Le message restait alors en attente alors qu'il était arrivé. Maintenant, un texte sans confirmation repart (même paquet chiffré : s'il était déjà arrivé, l'autre téléphone ne notifie rien et renvoie sa confirmation) au retour dans l'app après 45 s, puis toutes les 2 minutes, au plus 4 essais.
- Libellé sous un message en attente : « Envoyé · pas encore reçu par son téléphone » 30 s après l'envoi, au lieu de « ton contact n'a pas de connexion », qui n'était pas forcément vrai. Un renvoi automatique ne fait plus revenir « Envoi… ».

## 1.1.6 (versionCode 8)

### Résumé

- Les messages partent même si on quitte l'app juste après les avoir envoyés.
- Android ne ralentit plus les messages de Nébula : les pushs qui n'affichent rien partent en priorité normale.
- Une carte sur l'accueil prévient quand Android peut endormir Nébula, avec le bouton qui règle le problème.

### Détails

#### Corrections

- Envoi en arrière-plan : avant, tout se coupait dès qu'on quittait l'app ; un message pas encore parti attendait la réouverture (Android 14 et 15 gèlent l'app et lui coupent le réseau quelques secondes après). Maintenant l'envoi se termine, au plus 45 secondes (3 minutes pour un fichier), sous une notification discrète « Envoi à… » qu'Android ne montre que si l'envoi traîne.
- Priorité des pushs : Android 13+ fait passer en priorité normale les pushs d'une app qui en reçoit trop sans notification ; en arrière-plan, un message ralenti ne pouvait alors plus être reçu avant l'ouverture. Les accusés de réception, modifications, suppressions, épingles, curseurs de lecture, profils et dates partent désormais en priorité normale ; messages, pensées, humeur, cycle et réactions restent en priorité haute.
- Accusés de réception : renvoyés deux fois s'ils échouent (le message de l'autre ne reste plus en « Envoi… »).
- Réponse depuis la notification : deux nouveaux essais si le push n'est pas parti.
- Réseau : un message n'attend plus quand Android croit à tort le téléphone sans internet.

#### Nouveautés

- Accueil : carte « Nébula peut s'endormir » (notifications coupées ou batterie optimisée), avec « Autoriser » et, sur Samsung, le réglage des applications jamais en veille.
- Diagnostic : « Rapidité des messages » dit combien de pushs récents Android a ralentis.

## 1.1.5 (versionCode 7)

### Résumé

- Le calendrier du cycle suit le doigt, comme une page qu'on tourne.
- L'onglet Nous : le titre « Aujourd'hui » ne chevauche plus les boutons.
- Retouche : toucher la photo n'ajoute plus de texte (l'outil Texte est là pour ça).

### Détails

#### Corrections

- Calendrier du cycle : les mois voisins sont dessinés de part et d'autre, le glissé se fait sous le doigt, sans saccade ; la grille garde toujours six semaines (la hauteur ne saute plus).
- Onglet Nous : le titre « Aujourd'hui » a sa propre ligne, aligné comme « Médias partagés ».
- Retouche : un toucher sur le média ne crée plus de texte ; toucher un texte existant le modifie toujours, et toucher la photo referme la rangée Ambiance.

## 1.1.4 (versionCode 6)

### Résumé

- Le calendrier du cycle se feuillette au doigt, et chaque jour a sa fiche : douleur, médicaments, humeur.
- Les écrans vides montrent le lys et quoi faire.
- L'onglet Nous repensé : son dernier message, les gestes rapides et la journée en un coup d'œil.
- Appareil photo et retouche redessinés : outils ronds, boutons Enregistrer et Envoyer en bas.
- Les marques heure, date, jour, lieu et batterie ont de vraies polices (serif, sans, écriture à la main).
- Sous le capot : synchronisation du couple réunie, publication en une seule commande.

### Détails

#### Nouveautés

- Calendrier du cycle : glisser vers la gauche ou la droite pour changer de mois.
- Fiche d'un jour : phase, douleur (modifiable par elle pour un jour passé), médicaments pris ce jour-là, humeur notée ce jour-là.
- États vides (Nos dates, stickers, stockage, médicaments) : le lys, une phrase claire et, quand il y en a une, l'action à faire.
- Onglet Nous : dernier message avec un bouton pour répondre, raccourcis (Pense à toi, Appeler, Position, Photo) et la liste « Aujourd'hui » (humeur, cycle, distance, prochaine date).
- Appareil photo : « Pour [prénom] » en haut quand on vient d'une conversation, zoom en pastilles, déclencheur au cœur lilas, onglets Photo / Vidéo en rail.
- Retouche photo et vidéo : en-tête « Retoucher », média aux coins arrondis, outils ronds avec leur nom (la vitesse s'écrit dans son bouton), Enregistrer et Envoyer en bas.
- Ambiance : la rangée des filtres prend la place des boutons du bas (la photo reste visible en entier), vignettes de la photo écrites dans la police de chaque marque, anneau lilas ; toucher encore la marque choisie change de style ; toucher la photo referme la rangée.
- Marques redessinées avec quatre polices embarquées (Instrument Serif, Space Grotesk, Caveat, DM Mono) : trois styles par marque, étiquette en pilule, épingle pour le lieu, écriture penchée.

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
