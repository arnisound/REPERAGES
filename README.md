# Repérages

Application web (PWA) pour réaliser des repérages techniques d'événements : localisation GPS des repères sur une carte, photos, et plans techniques à l'échelle (électricité, plomberie, réseau, audio, lumière).

Optimisée mobile en priorité, fonctionne aussi sur tablette et ordinateur. Installable comme application (PWA) et utilisable hors-ligne une fois chargée. Toutes les données sont stockées localement sur l'appareil (IndexedDB) — aucun compte, aucun serveur.

## Fonctionnalités

- **Événements** : un projet par événement (nom, client, lieu, date, notes).
- **Carte du site** : sur place, on délimite la zone du site directement sur la carte (fond plan ou satellite) ; l'aire est calculée automatiquement.
- **Plan à l'échelle sur la carte** : placement d'objets aux dimensions réelles (tentes, chapiteaux, scènes, bars, armoires électriques, groupes électrogènes…) directement sur la zone, avec rotation et déplacement. L'échelle est donnée par le GPS — aucune calibration nécessaire.
- **Lignes techniques** : tracé de câbles (élec, audio, DMX…), tuyaux et barrières ; longueur réelle calculée automatiquement, avec comptage des éléments (ex. barrières de 2 m, clôtures Heras).
- **Câblage aimanté** : pendant le tracé d'un câble, les points s'aimantent aux objets proches (armoires, stagebox…) et les extrémités restent **ancrées** — déplacer l'objet (seul ou en groupe) déplace le câble avec lui.
- **Assistant de distribution** : chaque objet propose ses départs de câble réels — élec : armoire TRI 125A → 2× TRI 63A / 4× TRI 32A, TRI 63A → 2× TRI 32A / 12× 16A MONO, TRI 32A → 6× 16A MONO, groupe 100 kVA → TRI 125A… ; son : stagebox Dante/AES67 → XLR ou Cat, stagebox AES50 (Midas/Behringer), interface MADI, splitter AES/EBU ; lumière : node ArtNet/sACN → DMX (2/4/8 sorties), splitter DMX, gradateur ; un bouton lance le tracé du bon câble au bon calibre, ancré à l'objet.
- **Câbles de secours (spare)** : suggestion réglable (0/10/15/20 % du nombre de tronçons, minimum 1 par type de câble) affichée au récap, dans le texte copié et le PDF.
- **Lisibilité du plan** : les petits objets gardent une taille minimum à l'écran quand on dézoome (pictogramme lisible) et retrouvent leurs dimensions réelles en zoomant.
- **9 calques métier** : Implantation, Structures (truss par éléments, échafaudages, tours de levage, hauteurs), Électricité, Eau/Plomberie, Réseau, Vidéo, Audio, Lumière, Sécurité — activables individuellement.
- **Lieux intérieurs** : création d'un plan sans zone GPS (croquis coté) — murs dessinés en saisissant les longueurs au mètre laser avec directions à angle droit.
- **Relevé GPS de terrain** : en délimitant la zone, bouton « + à ma position » pour poser un sommet à chaque arrêt en marchant le long des façades/limites.
- **Superposition de plans** : un plan importé (photo/PDF exporté en image) peut être géoréférencé sur le plan du site — position au doigt, rotation, largeur réelle en mètres (automatique si calibré), opacité.
- **Personnalisation par objet** : couleur, initiales et nom modifiables sur chaque objet placé ; calibres électriques (MONO 16A → POWERLOCK 400A) sur armoires, coffrets et câbles ; catégories RJ45 (Cat 5e → Cat 7).
- **Banque de matériel personnelle** : créez vos propres modèles (nom, initiales, couleur, dimensions) par calque — disponibles sur tous les événements et inclus dans les sauvegardes.
- **Multi-sélection** : sélectionner plusieurs objets/lignes sur le plan pour les déplacer en groupe, les dupliquer ou les supprimer.
- **Récap matériel** : décompte automatique des objets par calque et des câbles par tirage, avec découpe optimale en tronçons du commerce (5/10/15/20/25/50 m, touret 100 m) — chute et longueur fournie calculées ; récap copiable en texte.
- **Repères GPS** : points d'intérêt (accès, arrivée EDF, point d'eau, contraintes…) avec photos.
- **Plans importés** (lieux intérieurs) : import d'une photo/plan, calibration 2 points, objets aux dimensions réelles et câbles avec longueur calculée.
- **Photos** : prise directe (caméra) ou import, stockées localement.
- **Mesures et cotes** : outil règle pour mesurer au doigt, cotes permanentes en mètres sur le plan.
- **Suivi de montage** : statut par élément (à installer / installé / vérifié), mode pointage sur le plan le jour J, progression par calque au récap.
- **Bilan de puissance** : puissance kW par objet, totaux par calque et global.
- **Export du plan** : **zone d'impression** ajustable au doigt (cadre A4), **dossier PDF multi-pages** (page plan + toutes les infos de l'événement, puis récap matériel détaillé par calque sur autant de pages que nécessaire), image PNG haute résolution, aperçu à imprimer, et **DXF** ouvrable dans AutoCAD/QCAD/LibreCAD (entités CAO à l'échelle en mètres, un calque par discipline, enregistrable en DWG) — avec option **contours cartographiques** (bâtiments et voiries alentour depuis OpenStreetMap).
- **6 fonds de carte** : OpenStreetMap, satellite Esri, topographique (relief), terrain Esri, clair et sombre CARTO — sur la carte comme en fond du plan, mis en cache hors-ligne.
- **Recherche d'objets** : champ de recherche trans-calques dans le sélecteur (catalogue + banque perso).
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
