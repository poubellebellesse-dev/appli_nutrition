// ui/test-socle.ts — de quoi monter un écran réel dans un DOM simulé.
//
// ⚠️ CE FICHIER EXISTE PARCE QUE LES ÉCRANS N'ÉTAIENT TESTÉS PAR RIEN. La fiche de reprise le disait
// sans détour : « zéro test d'interface. Sur les défauts de la session 5, trois ont été trouvés en
// utilisant l'application, un en relisant le code, AUCUN par la suite de tests. » La session
// suivante en a produit trois de plus, du même genre — une case décochée en revenant en arrière, un
// encart qui se referme sous le doigt, un ingrédient qui ne s'ajoute pas — tous trouvés en pilotant
// un navigateur à la main. Ce sont des bugs d'ÉTAT REACT, et ils se prennent ici.
//
// ⚠️ ON NE REMPLACE QUE LES DEUX MODULES QUI NE PEUVENT PAS TOURNER HORS NAVIGATEUR :
// `catalog-source.ts` (fetch + sqlite-wasm) et `user-source.ts` (OPFS). Tout le reste s'exécute
// pour de vrai — `socle.ts`, le moteur, `user.db`, la fusion des recettes personnelles. C'est ce
// qui sépare un test d'écran utile d'un test qui vérifie des maquettes : les écrans de ce projet
// passent leur temps à parler au moteur et à la base, et c'est là que vivent les régressions.
//
// ⚠️ AUCUNE BRANCHE « MODE TEST » DANS LE CODE DE PRODUCTION. La substitution se fait par
// `vi.mock` dans chaque fichier de test ; `socle.ts` ignore que ce fichier existe.
//
// ⚠️ LE CATALOGUE EST CELUI DU DÉPÔT (`app/public/catalog/catalog.db`), LU EN LECTURE SEULE. Les
// suites de `tests/` reconstruisent le leur dans un dossier temporaire parce qu'elles tournent en
// parallèle du build ; ici on ne fait que lire. S'il manque : `npm run build`.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Catalog } from '../engine/domain/index.js'
import type { ConfianceParAliment } from '../data/catalog-loader.js'
import { loadCatalog, loadConfiance } from '../data/catalog-loader-node.js'
import { openUserDb } from '../data/user-store-node.js'
import type { UserDb } from '../data/user-db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CATALOGUE = path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db')

/** Lu une seule fois par fichier de test : relire 647 Ko par test coûterait plus que tout le reste. */
let catalogue: Catalog | undefined

export function catalogueDeTest(): Catalog {
  catalogue ??= loadCatalog(CATALOGUE)
  return catalogue
}

/**
 * Cotes de confiance ANSES du catalogue de test (décision 33).
 *
 * ⚠️ CHARGÉES DEPUIS LE MÊME `catalog.db`, pas inventées. Une table vide ferait passer tous les
 * tests d'affichage de provenance sans rien prouver — exactement la panne que ce projet cherche
 * partout ailleurs : un test vert parce qu'il n'y a rien à vérifier.
 */
let confiance: ConfianceParAliment | undefined

export function confianceDeTest(): ConfianceParAliment {
  confiance ??= loadConfiance(CATALOGUE)
  return confiance
}

/**
 * La base du test courant.
 *
 * ⚠️ UNE BASE NEUVE PAR TEST (`reinitialiserBase` en `beforeEach`). Deux tests qui partageraient
 * `user.db` verraient les allergies de l'un filtrer les suggestions de l'autre, et l'ordre
 * d'exécution déciderait du résultat — le genre d'échec qui n'apparaît qu'en CI.
 */
let base: UserDb | undefined

export function reinitialiserBase(): UserDb {
  base = openUserDb(':memory:').db
  return base
}

export function baseCourante(): UserDb {
  base ??= reinitialiserBase()
  return base
}

/** Ce que `user-source.ts` rend, en mémoire. `persistant: true` : pas de bandeau dans les tests. */
export function sessionDeTest(): { db: UserDb; stockage: 'memoire'; persistant: boolean } {
  return { db: baseCourante(), stockage: 'memoire', persistant: true }
}
