import { describe, expect, it } from 'vitest'
import { injecterQuantites, type IngredientDeLEtape } from './texte-etape.js'

/** Le texte reconstitué, tel qu'il s'affichera. */
function rendu(texte: string, ingredients: readonly IngredientDeLEtape[]): string {
  return injecterQuantites(texte, ingredients)
    .segments.map((s) => s.contenu)
    .join('')
}

const oignon: IngredientDeLEtape = {
  foodId: 'oignon',
  formes: ['Oignon, cru', 'oignon'],
  quantite: '1 gros oignon',
}
const beurre: IngredientDeLEtape = {
  foodId: 'beurre_doux',
  formes: ['Beurre, doux', 'beurre doux'],
  quantite: '50 g',
}
const huile: IngredientDeLEtape = {
  foodId: 'huile_olive',
  formes: ["Huile d'olive", 'huile olive'],
  quantite: '1 filet',
}
const citron: IngredientDeLEtape = {
  foodId: 'citron',
  formes: ['Citron, pulpe, cru', 'citron'],
  quantite: '1/2 citron',
}

describe('injecterQuantites', () => {
  describe('la quantité prend la place du déterminant', () => {
    it("remplace « l'article + nom » par le libellé quand celui-ci nomme déjà l'aliment", () => {
      expect(rendu("Émincer l'oignon.", [oignon])).toBe('Émincer 1 gros oignon.')
    })

    it('accorde le pluriel du texte sans y toucher — le libellé fait foi', () => {
      const poivrons = {
        foodId: 'poivron_rouge',
        formes: ['Poivron, rouge, cru', 'poivron rouge'],
        quantite: '2 poivrons rouges',
      }
      expect(rendu('Découper les poivrons.', [poivrons])).toBe('Découper 2 poivrons rouges.')
    })

    it('reconnaît un libellé à trait d’union — les deux côtés se découpent pareil', () => {
      const chouFleur = {
        foodId: 'chou_fleur',
        formes: ['Chou-fleur, cru', 'chou fleur'],
        quantite: '1 chou-fleur',
      }
      expect(rendu('Détailler le chou-fleur en bouquets.', [chouFleur])).toBe(
        'Détailler 1 chou-fleur en bouquets.'
      )
    })

    it('de même au pluriel — « 2 choux-raves », pas « 2 choux-raves de choux-raves »', () => {
      const chouxRaves = {
        foodId: 'chou_rave',
        formes: ['Chou-rave, cru', 'chou rave'],
        quantite: '2 choux-raves',
      }
      expect(rendu('Éplucher les choux-raves.', [chouxRaves])).toBe('Éplucher 2 choux-raves.')
    })

    it('reconnaît la forme complète en plusieurs mots', () => {
      const poivrons = {
        foodId: 'poivron_rouge',
        formes: ['Poivron, rouge, cru', 'poivron rouge'],
        quantite: '2 poivrons rouges',
      }
      expect(rendu('Émincer les poivrons rouges et les faire revenir.', [poivrons])).toBe(
        'Émincer 2 poivrons rouges et les faire revenir.'
      )
    })

    it('met la majuscule quand la substitution ouvre la phrase', () => {
      expect(rendu("L'oignon est émincé finement.", [oignon])).toBe(
        '1 gros oignon est émincé finement.'
      )
    })
  })

  describe('les masses et volumes prennent une liaison', () => {
    it('relie par « de » devant une consonne', () => {
      expect(rendu('Faire fondre le beurre.', [beurre])).toBe('Faire fondre 50 g de beurre.')
    })

    it("élide en « d' » devant une voyelle", () => {
      const creme = {
        foodId: 'creme_fraiche',
        formes: ['Crème fraîche'],
        quantite: '20 cl',
      }
      expect(rendu('Verser la crème et mélanger.', [creme])).toBe(
        'Verser 20 cl de crème et mélanger.'
      )
      const asperges = {
        foodId: 'asperge_verte',
        formes: ['Asperge, verte, crue'],
        quantite: '2 bottes',
      }
      expect(rendu('Éplucher les asperges.', [asperges])).toBe("Éplucher 2 bottes d'asperges.")
    })

    it("élide devant un h muet, jamais devant un h aspiré", () => {
      expect(rendu("Ajouter l'huile.", [huile])).toBe("Ajouter 1 filet d'huile.")
      const haricots = {
        foodId: 'haricot_vert',
        formes: ['Haricot vert, cru', 'haricot vert'],
        quantite: '200 g',
      }
      expect(rendu('Faire cuire les haricots.', [haricots])).toBe(
        'Faire cuire 200 g de haricots.'
      )
    })

    it('garde le mot tel qu’il est écrit dans la recette, pas le nom CIQUAL', () => {
      // « Beurre, doux » ne doit jamais ressortir tel quel dans la phrase.
      expect(rendu('Faire fondre le beurre.', [beurre])).not.toContain('doux')
    })
  })

  // ⚠️ CE BLOC A DÉJÀ FIGÉ LE CONTRAIRE, ET C'ÉTAIT FAUX SUR 85 PHRASES DU CATALOGUE. Le `de` nu
  // derrière un infinitif était SUPPRIMÉ, au motif qu'il ouvrait un complément d'objet. Il est en
  // réalité RÉGI PAR LE VERBE : « Arroser d'huile » n'a pas d'article à effacer, et le retirer
  // retourne la phrase — « Arroser 3 c. à soupe d'huile » dit qu'on arrose l'huile.
  describe('le « de » nu derrière un infinitif reste, et accueille la quantité', () => {
    const coco = {
      foodId: 'noix_coco_rapee',
      formes: ['Noix de coco, râpée', 'noix coco rapee'],
      quantite: '3 c. à soupe',
    }

    it('garde le « de » régi par le verbe', () => {
      expect(rendu('Parsemer de noix de coco râpée.', [coco])).toBe(
        'Parsemer de 3 c. à soupe de noix de coco râpée.'
      )
    })

    it('élide devant une quantité qui commence par une voyelle ou par 1', () => {
      const farine = { foodId: 'farine', formes: ['Farine de blé', 'farine'], quantite: '1 c. à soupe' }
      expect(rendu('Saupoudrer de farine.', [farine])).toBe("Saupoudrer d'1 c. à soupe de farine.")
    })

    it('ne le contracte JAMAIS en « des », même au pluriel — il n’a pas d’article', () => {
      const huileOlive = {
        foodId: 'huile_olive',
        formes: ["Huile d'olive"],
        quantite: '3 cuillères à soupe',
      }
      // Le contraste est avec « le reste DU beurre » → « des 50 g » : là il y a un article à
      // contracter. Ici « arroser DE » n'en porte aucun, « arroser des 3 cuillères » serait fautif.
      expect(rendu("Arroser d'huile d'olive.", [huileOlive])).toBe(
        "Arroser de 3 cuillères à soupe d'huile d'olive."
      )
    })

    it('laisse la coordination qui suit se rattacher correctement', () => {
      const huileOlive = {
        foodId: 'huile_olive',
        formes: ["Huile d'olive"],
        quantite: '3 cuillères à soupe',
      }
      expect(rendu("Arroser d'huile d'olive et de citron.", [huileOlive])).toBe(
        "Arroser de 3 cuillères à soupe d'huile d'olive et de citron."
      )
    })

    it('n’y touche pas quand le « de » suit un NOM — c’est un complément de nom', () => {
      const sirop = {
        foodId: 'sirop_erable',
        formes: ["Sirop d'érable"],
        quantite: '3 c. à soupe',
      }
      // « un filet de sirop » : le mot devant le partitif est « filet », pas un infinitif. La phrase
      // porte déjà sa propre quantité — injecter en poserait une seconde.
      expect(rendu("Napper d'un filet de sirop d'érable.", [sirop])).toBe(
        "Napper d'un filet de sirop d'érable."
      )
    })

    it('le garde aussi quand le libellé nomme déjà l’aliment', () => {
      const tomate = {
        foodId: 'tomate',
        formes: ['Tomate, crue', 'tomate'],
        quantite: '2 tomates',
      }
      expect(rendu('Garnir de tomates concassées.', [tomate])).toBe(
        'Garnir de 2 tomates concassées.'
      )
    })
  })

  // Le second cas de la règle : le déterminant ne peut pas disparaître (le groupe appartient à un
  // nom, pas au verbe), alors il RESTE et s'accorde au nombre de la quantité.
  describe('l’accord du déterminant', () => {
    const artichaut = {
      foodId: 'artichaut',
      formes: ['Artichaut, cru', 'artichaut'],
      quantite: '4 artichauts',
    }
    const beurre50 = { foodId: 'beurre_doux', formes: ['Beurre, doux'], quantite: '50 g' }

    it('« des » accueille la quantité au lieu de disparaître', () => {
      expect(rendu('Casser la queue des artichauts à la main.', [artichaut])).toBe(
        'Casser la queue des 4 artichauts à la main.'
      )
    })

    it('« aux » de même', () => {
      const poireau = { foodId: 'poireau', formes: ['Poireau, cru'], quantite: '2 poireaux' }
      expect(rendu('Ajouter la crème aux poireaux.', [poireau])).toBe(
        'Ajouter la crème aux 2 poireaux.'
      )
    })

    it('« du » passe au pluriel quand la quantité est plurielle, SANS affirmer la totalité', () => {
      // ⛔ LE CAS QUI DÉCIDE DE LA RÈGLE. « Le reste des 50 g de beurre » dit le reste DE ces 50 g —
      // le sens de la recette est intact. Remplacer aurait donné « le reste 50 g de beurre », qui
      // affirme qu'on met les 50 g. Un nombre faux se suit ; c'est la seule erreur qui compte.
      expect(rendu('Faire un roux avec le reste du beurre et la farine.', [beurre50])).toBe(
        'Faire un roux avec le reste des 50 g de beurre et la farine.'
      )
    })

    it("« de l' » s'élide au singulier", () => {
      const oignonGros = {
        foodId: 'oignon',
        formes: ['Oignon, cru', 'oignon'],
        quantite: '1 gros oignon',
      }
      expect(rendu("Mêler la viande et la moitié de l'oignon.", [oignonGros])).toBe(
        "Mêler la viande et la moitié d'1 gros oignon."
      )
    })

    it('« chaque » devient « les » au pluriel', () => {
      const banane = { foodId: 'banane', formes: ['Banane, pulpe'], quantite: '4 bananes' }
      expect(rendu('Fendre chaque banane dans la longueur.', [banane])).toBe(
        'Fendre les 4 bananes dans la longueur.'
      )
    })

    it("n'accorde RIEN quand la quantité n'apporte rien de plus que le nom déjà écrit", () => {
      // « la chair de la courge » + « 1 courge spaghetti » : un seul exemplaire, et pas un mot de
      // plus que le nom. « de 1 courge spaghetti » alourdit sans informer.
      const courge = {
        foodId: 'courge_spaghetti',
        formes: ['Courge spaghetti, crue', 'courge spaghetti'],
        quantite: '1 courge spaghetti',
      }
      expect(rendu('Racler la chair de la courge à la fourchette.', [courge])).toBe(
        'Racler la chair de la courge à la fourchette.'
      )
    })

    it('« de chaque » se contracte en « des », jamais en « de les »', () => {
      const asperge = {
        foodId: 'asperge_verte',
        formes: ['Asperge, verte, crue'],
        quantite: '2 bottes',
      }
      expect(rendu('Casser la base ligneuse de chaque asperge à la main.', [asperge])).toBe(
        "Casser la base ligneuse des 2 bottes d'asperge à la main."
      )
    })

    it('remplace au lieu d’accorder quand une préposition ouvre le groupe', () => {
      // « Servir avec du pain » : le groupe appartient au verbe, pas à un nom — « avec de ½ pain »
      // serait fautif.
      const pain = { foodId: 'pain_complet', formes: ['Pain complet'], quantite: '1/2 pain' }
      expect(rendu('Servir aussitôt avec du pain coupé en mouillettes.', [pain])).toBe(
        'Servir aussitôt avec 1/2 pain coupé en mouillettes.'
      )
    })
  })

  describe('les garde-fous — ne rien injecter vaut mieux qu’une phrase cassée', () => {
    it('laisse le complément de nom intact (« le jus de citron »)', () => {
      const r = injecterQuantites('Arroser avec le jus de citron.', [citron])
      expect(rendu('Arroser avec le jus de citron.', [citron])).toBe(
        'Arroser avec le jus de citron.'
      )
      expect(r.injectes.size).toBe(0)
    })

    it("laisse « au » intact — c'est un complément de manière, pas l'ingrédient", () => {
      const beurre2 = { foodId: 'beurre_doux', formes: ['Beurre, doux'], quantite: '50 g' }
      expect(rendu('Faire sauter les champignons au beurre.', [beurre2])).toBe(
        'Faire sauter les champignons au beurre.'
      )
    })

    it("laisse « d'un filet de » intact — la phrase porte déjà sa quantité", () => {
      const huileOlive = {
        foodId: 'huile_olive',
        formes: ["Huile d'olive"],
        quantite: '3 c. à soupe',
      }
      expect(rendu("Arroser d'un filet d'huile d'olive.", [huileOlive])).toBe(
        "Arroser d'un filet d'huile d'olive."
      )
    })

    it("laisse intact le déterminant précédé de « de » (« le jus de l'orange »)", () => {
      const orange = { foodId: 'orange', formes: ['Orange, pulpe'], quantite: '1 orange' }
      expect(rendu("Presser le jus de l'orange.", [orange])).toBe("Presser le jus de l'orange.")
    })

    it("n'injecte aucun libellé dépourvu de nombre", () => {
      const sel: IngredientDeLEtape = {
        foodId: 'sel_fin',
        formes: ['Sel', 'sel fin'],
        quantite: 'au goût',
      }
      const persil: IngredientDeLEtape = {
        foodId: 'persil',
        formes: ['Persil, frais'],
        quantite: 'quelques brins',
      }
      const r = injecterQuantites('Ajouter le sel et le persil.', [sel, persil])
      expect(rendu('Ajouter le sel et le persil.', [sel, persil])).toBe(
        'Ajouter le sel et le persil.'
      )
      expect(r.injectes.size).toBe(0)
    })

    it("ne touche à rien quand l'ingrédient n'est pas nommé dans le texte", () => {
      const r = injecterQuantites('Préchauffer le four à 190 °C.', [oignon, beurre])
      expect(r.segments).toEqual([{ type: 'texte', contenu: 'Préchauffer le four à 190 °C.' }])
      expect(r.injectes.size).toBe(0)
    })

    it("n'injecte rien quand l'étape n'a aucun ingrédient rattaché", () => {
      const r = injecterQuantites('Couvrir et laisser mijoter.', [])
      expect(r.segments).toEqual([{ type: 'texte', contenu: 'Couvrir et laisser mijoter.' }])
    })
  })

  describe('plusieurs ingrédients dans la même phrase', () => {
    it('les injecte tous, chacun à sa place', () => {
      expect(rendu("Faire revenir l'oignon dans le beurre avec l'huile.", [oignon, beurre, huile]))
        .toBe("Faire revenir 1 gros oignon dans 50 g de beurre avec 1 filet d'huile.")
    })

    it('ne remplace jamais deux fois le même morceau de phrase', () => {
      const poivron = {
        foodId: 'poivron_rouge',
        formes: ['Poivron, rouge, cru'],
        quantite: '1 poivron',
      }
      const poivronJaune = {
        foodId: 'poivron_jaune',
        formes: ['Poivron, jaune, cru'],
        quantite: '1 poivron jaune',
      }
      const r = injecterQuantites('Couper le poivron.', [poivron, poivronJaune])
      // Le premier de la liste gagne ; le second garde son badge.
      expect(r.injectes).toEqual(new Set(['poivron_rouge']))
      expect(rendu('Couper le poivron.', [poivron, poivronJaune])).toBe('Couper 1 poivron.')
    })

    it('rend les segments dans l’ordre du texte, pas dans celui des ingrédients', () => {
      const r = injecterQuantites("Mettre le beurre puis l'oignon.", [oignon, beurre])
      expect(r.segments.map((s) => s.contenu)).toEqual([
        'Mettre ',
        '50 g',
        ' de beurre',
        " puis ",
        '1 gros oignon',
        '.',
      ])
    })
  })

  describe('ce qui est injecté sort de la ligne de badges', () => {
    it('rend exactement les foodIds posés dans la phrase', () => {
      const r = injecterQuantites("Faire revenir l'oignon dans le beurre.", [oignon, beurre, huile])
      // `huile` n'est pas nommée : elle reste au badge, l'union des deux couvre les trois.
      expect(r.injectes).toEqual(new Set(['oignon', 'beurre_doux']))
    })

    it('marque le segment injecté avec son foodId', () => {
      const r = injecterQuantites("Émincer l'oignon.", [oignon])
      expect(r.segments.filter((s) => s.type === 'quantite')).toEqual([
        { type: 'quantite', contenu: '1 gros oignon', foodId: 'oignon' },
      ])
    })
  })

  describe('les noms en plusieurs mots', () => {
    it('apparie « pomme de terre » malgré le « de » que le nom CIQUAL ne porte pas', () => {
      // ⛔ SANS LE SAUT DES MOTS VIDES, seul « pommes » s'appariait et la phrase rendait
      // « 6 pommes de terre DE TERRE » — la queue orpheline passait pour du texte ordinaire.
      const pdt = {
        foodId: 'pomme_de_terre',
        formes: ['Pomme de terre, crue', 'pomme de terre'],
        quantite: '6 pommes de terre',
      }
      expect(rendu('Cuire jusqu’à ce que les pommes de terre se défassent.', [pdt])).toBe(
        'Cuire jusqu’à ce que 6 pommes de terre se défassent.'
      )
    })

    // ⛔ MÊME FAMILLE, AUTRE CAUSE. Ici c'est la forme COMPLÈTE qui échoue — le nom CIQUAL porte une
    // mention absente de la phrase — et le repli sur le mot de tête ne couvre qu'un mot. Le libellé,
    // lui, redit le nom entier, d'où la queue en double. Réparé en aval, par extension du match.
    it('avale la queue du nom composé quand seul le mot de tête s’est apparié', () => {
      const chou = {
        foodId: 'chou_chinois',
        formes: ['Chou chinois (pak-choï), cru'],
        quantite: '1 demi-chou chinois',
      }
      expect(rendu('Émincer le chou chinois en lanières.', [chou])).toBe(
        'Émincer 1 demi-chou chinois en lanières.'
      )
    })

    it('traverse le « d’ » élidé pour avaler la queue — « jaunes d’œufs »', () => {
      const jaune = {
        foodId: 'oeuf_jaune',
        formes: ["Œuf, jaune, cru", "jaune d'œuf"],
        quantite: "4 jaunes d'œufs",
      }
      expect(rendu("Délayer les jaunes d'œufs dans la crème.", [jaune])).toBe(
        "Délayer 4 jaunes d'œufs dans la crème."
      )
    })

    it('⛔ ne franchit PAS une virgule pour avaler le nom du voisin', () => {
      // « concentré de tomate, les tomates » : sans ce garde-fou l'extension prenait « les tomates »,
      // et l'ingrédient `tomate`, privé de sa place, perdait son injection.
      const concentre = {
        foodId: 'concentre_tomate',
        formes: ['Concentré de tomate'],
        quantite: '2 c. à soupe',
      }
      const tomate = { foodId: 'tomate', formes: ['Tomate, crue'], quantite: '3 tomates' }
      expect(rendu('Ajouter le concentré de tomate, les tomates concassées.', [concentre, tomate])).toBe(
        'Ajouter 2 c. à soupe de concentré de tomate, 3 tomates concassées.'
      )
    })

    it('⛔ ne franchit PAS une coordination', () => {
      const chou = { foodId: 'chou_vert', formes: ['Chou vert, cru'], quantite: '1 chou vert' }
      expect(rendu('Ajouter le chou vert et le chou-fleur.', [chou])).toBe(
        'Ajouter 1 chou vert et le chou-fleur.'
      )
    })
  })

  describe('les accents et la ligature ne font pas rater le mot', () => {
    it("relie « œuf » écrit avec la ligature", () => {
      const oeuf = { foodId: 'oeuf', formes: ['Œuf, cru'], quantite: '3 œufs' }
      expect(rendu('Battre les œufs en omelette.', [oeuf])).toBe('Battre 3 œufs en omelette.')
    })

    it("relie un nom accentué du catalogue à sa forme accentuée dans le texte", () => {
      const echalote = { foodId: 'echalote', formes: ['Échalote, crue'], quantite: '1 échalote' }
      expect(rendu("Ciseler l'échalote.", [echalote])).toBe('Ciseler 1 échalote.')
    })
  })
})
