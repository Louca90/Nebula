# Nébula

L'app de messagerie de Louca et de sa copine, rien que pour eux deux. Elle repose sur la même base que [Pear](https://github.com/Louca90/Pear) : connexion directe entre les deux téléphones, chiffrement de bout en bout, même serveur de réveil et même projet Firebase. Seule l'interface change, avec les fonds violets à grain, le lys et des fonctions de couple (nos dates, pense à toi…).

## Installer

Télécharge `nebula-X.Y.Z.apk` depuis la [dernière release](https://github.com/Louca90/Nebula/releases/latest), puis ouvre-le sur le téléphone. Ensuite, l'app se met à jour toute seule à partir des releases de ce dépôt.

## Développer

```sh
npm ci
npx expo prebuild -p android --no-install
npx expo run:android
```

Il faut placer à la racine le `google-services.json` de l'app Android `com.louca.nebula` du projet Firebase `pear-2c275`. Il n'est pas versionné.
