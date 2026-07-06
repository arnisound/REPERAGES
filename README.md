# Repérages

Application web (PWA) pour réaliser des repérages techniques d'événements : localisation GPS des repères sur une carte, photos, et plans techniques à l'échelle (électricité, plomberie, réseau, audio, lumière).

Optimisée mobile en priorité, fonctionne aussi sur tablette et ordinateur. Installable comme application (PWA) et utilisable hors-ligne une fois chargée. Toutes les données sont stockées localement sur l'appareil (IndexedDB) — aucun compte, aucun serveur.

## Fonctionnalités

- **Événements** : un projet par événement (nom, client, lieu, date, notes).
- **Carte GPS** : géolocalisation, placement de repères (accès, alimentation électrique, eau, réseau, contraintes…), fiche par repère avec photos.
- **Plans techniques** : import d'une photo de lieu ou d'un plan existant, calibration à l'échelle réelle (2 points + distance connue), calques activables (Électricité, Plomberie, Réseau, Audio, Lumière), placement de symboles, tracé de câbles/lignes avec longueur calculée automatiquement.
- **Photos** : prise directe (caméra) ou import, stockées localement.
- **Sauvegarde / transfert** : export d'un événement en `.zip` (données + photos), ré-import sur un autre appareil.

## Développement

```bash
npm install
npm run dev
```

```bash
npm run build    # build de production (tsc + vite build)
npm run preview  # prévisualiser le build
```

## Stack technique

- React + TypeScript + Vite, PWA (`vite-plugin-pwa`)
- Dexie (IndexedDB) pour le stockage local
- React Leaflet / OpenStreetMap pour la carte
- React Konva pour l'éditeur de plans à l'échelle
- JSZip / FileSaver pour l'export-import
