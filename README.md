# Repérages

Application web (PWA) pour réaliser des repérages techniques d'événements : localisation GPS des repères sur une carte, photos, et plans techniques à l'échelle (électricité, plomberie, réseau, audio, lumière).

Optimisée mobile en priorité, fonctionne aussi sur tablette et ordinateur. Installable comme application (PWA) et utilisable hors-ligne une fois chargée. Toutes les données sont stockées localement sur l'appareil (IndexedDB) — aucun compte, aucun serveur.

## Fonctionnalités

- **Événements** : un projet par événement (nom, client, lieu, date, notes).
- **Carte du site** : sur place, on délimite la zone du site directement sur la carte (fond plan ou satellite) ; l'aire est calculée automatiquement.
- **Plan à l'échelle sur la carte** : placement d'objets aux dimensions réelles (tentes, chapiteaux, scènes, bars, armoires électriques, groupes électrogènes…) directement sur la zone, avec rotation et déplacement. L'échelle est donnée par le GPS — aucune calibration nécessaire.
- **Lignes techniques** : tracé de câbles (élec, audio, DMX…), tuyaux et barrières ; longueur réelle calculée automatiquement, avec comptage des éléments (ex. barrières de 2 m, clôtures Heras).
- **6 calques métier** : Implantation, Électricité, Eau/Plomberie, Audio, Lumière, Sécurité — activables individuellement.
- **Repères GPS** : points d'intérêt (accès, arrivée EDF, point d'eau, contraintes…) avec photos.
- **Plans importés** (lieux intérieurs) : import d'une photo/plan, calibration 2 points, objets aux dimensions réelles et câbles avec longueur calculée.
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
