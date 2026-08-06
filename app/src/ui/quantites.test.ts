// ui/quantites.test.ts — mise à l'échelle des quantités affichées.
//
// Les quatre premiers cas sont ceux signalés à l'usage sur la fiche recette : « 4 artichauts »
// devenait « 2,4 kg », les cuillères devenaient des grammes, les centilitres aussi, et le sel
// s'affichait à « 8 g ». Ils sont testés tels quels — un test écrit d'après le rapport plutôt que
// d'après l'implémentation.

import { describe, expect, it } from 'vitest'
import { formaterMasse, formaterQuantiteAchat, quantiteAffichee } from './quantites.js'

const base = {
  facteur: 2,
  fondDePlacard: false,
  grammes: 1000,
}

describe('ui/quantites — les quatre cas signalés à l’usage', () => {
  it('« 4 artichauts » doublé donne 8 artichauts, pas 2,4 kg', () => {
    expect(quantiteAffichee({ ...base, libelle: '4 artichauts' }).texte).toBe('8 artichauts')
  })

  it('une cuillère à soupe reste une cuillère à soupe', () => {
    expect(quantiteAffichee({ ...base, libelle: '2 cuillères à soupe' }).texte).toBe(
      '4 cuillères à soupe'
    )
  })

  it('les centilitres restent des centilitres — le catalogue n’a pourtant aucune densité', () => {
    // C'est tout l'intérêt de multiplier le LIBELLÉ : il porte l'unité que le catalogue ignore.
    expect(quantiteAffichee({ ...base, libelle: '20 cl de crème' }).texte).toBe('40 cl de crème')
  })

  it('le sel ne bouge PAS — personne ne mesure 8 g de sel', () => {
    const sel = quantiteAffichee({ ...base, libelle: '1 pincée de sel', fondDePlacard: true })
    expect(sel.texte).toBe('1 pincée de sel')
    // `fige` permet à l'écran de le dire, au lieu de laisser croire à un bug d'affichage.
    expect(sel.fige).toBe(true)
  })
})

describe('ui/quantites — nombre de tête', () => {
  it('met à l’échelle un poids déjà exprimé en kilos', () => {
    expect(quantiteAffichee({ ...base, libelle: '1,2 kg de sauté de veau' }).texte).toBe(
      '2,4 kg de sauté de veau'
    )
  })

  it('accepte le point comme séparateur décimal', () => {
    expect(quantiteAffichee({ ...base, libelle: '1.5 l de bouillon' }).texte).toBe('3 l de bouillon')
  })

  it('comprend les fractions et les rend en caractère', () => {
    expect(quantiteAffichee({ ...base, facteur: 1.5, libelle: '1/2 citron' }).texte).toBe('¾ citron')
    expect(quantiteAffichee({ ...base, libelle: '1/2 citron' }).texte).toBe('1 citron')
  })

  it('rend une demi-portion sans produire de décimale illisible', () => {
    expect(quantiteAffichee({ ...base, facteur: 0.5, libelle: '3 œufs' }).texte).toBe('1 ½ œuf')
  })

  it('NE TOUCHE PAS à un nombre qui n’est pas en tête', () => {
    // « Poulet 220 g » : le 220 n'est pas la quantité en position de tête. Le multiplier
    // produirait un libellé faux et crédible, le pire des deux.
    expect(quantiteAffichee({ ...base, libelle: 'Poulet 220 g' }).texte).toBe(formaterMasse(1000))
  })

  it('retombe sur les grammes quand le libellé n’a aucun nombre', () => {
    expect(quantiteAffichee({ ...base, libelle: 'quelques brins de ciboulette' }).texte).toBe('1 kg')
  })
})

describe('ui/quantites — accord du nom compté', () => {
  it('met au pluriel à partir de deux', () => {
    expect(quantiteAffichee({ ...base, libelle: '1 carotte' }).texte).toBe('2 carottes')
  })

  it('remet au singulier en dessous de deux', () => {
    expect(quantiteAffichee({ ...base, facteur: 0.5, libelle: '2 carottes' }).texte).toBe('1 carotte')
  })

  it('laisse les unités abrégées invariables — jamais « 40 cls »', () => {
    for (const unite of ['cl', 'g', 'kg', 'ml', 'l']) {
      expect(quantiteAffichee({ ...base, libelle: `20 ${unite}` }).texte).toBe(`40 ${unite}`)
    }
  })

  it('n’ajoute pas un second s à un mot qui finit déjà par s, x ou z', () => {
    expect(quantiteAffichee({ ...base, libelle: '2 choux' }).texte).toBe('4 choux')
    expect(quantiteAffichee({ ...base, libelle: '2 ananas' }).texte).toBe('4 ananas')
  })

  it("n'accorde QUE le mot compté, pas la suite du libellé", () => {
    // « cuillères » porte la marque, « à soupe » ne bouge pas.
    expect(quantiteAffichee({ ...base, facteur: 0.5, libelle: '2 cuillères à soupe' }).texte).toBe(
      '1 cuillère à soupe'
    )
  })
})

describe('ui/quantites — au facteur 1, on ne touche à rien', () => {
  it('rend le libellé d’origine, mieux écrit que tout ce qu’on produirait', () => {
    for (const libelle of ['4 artichauts', '1 pincée de sel', 'quelques brins de ciboulette']) {
      const rendu = quantiteAffichee({ ...base, facteur: 1, libelle })
      expect(rendu.texte).toBe(libelle)
      expect(rendu.fige).toBe(false)
    }
  })
})

describe('ui/quantites — formaterMasse', () => {
  it('arrondit au gramme, jamais au dixième', () => {
    expect(formaterMasse(83.3)).toBe('83 g')
  })

  it('passe en kilos au-delà de mille, avec une virgule française', () => {
    expect(formaterMasse(1000)).toBe('1 kg')
    expect(formaterMasse(2400)).toBe('2,4 kg')
  })
})

describe('ui/quantites — une MESURE ne se fractionne jamais', () => {
  it('arrondit les grammes au plus près plutôt que « 18 ¾ g »', () => {
    // 25 g x 0,75 = 18,75. La première version affichait « 18 ¾ g de beurre » : on ne pèse pas
    // trois quarts de gramme.
    expect(
      quantiteAffichee({ ...base, facteur: 0.75, libelle: '25 g de beurre' }).texte
    ).toBe('19 g de beurre')
  })

  it('fait monter la moitié', () => {
    expect(quantiteAffichee({ ...base, facteur: 0.5, libelle: '25 g de beurre' }).texte).toBe(
      '13 g de beurre'
    )
  })

  it('garde une décimale pour les kilos et les litres', () => {
    expect(quantiteAffichee({ ...base, facteur: 2, libelle: '1,2 kg de veau' }).texte).toBe(
      '2,4 kg de veau'
    )
    expect(quantiteAffichee({ ...base, facteur: 0.5, libelle: '1,5 l de bouillon' }).texte).toBe(
      '0,8 l de bouillon'
    )
  })

  it('ne descend jamais à zéro — « 0 g de beurre » ferait croire qu’il n’en faut pas', () => {
    expect(quantiteAffichee({ ...base, facteur: 0.01, libelle: '25 g de beurre' }).texte).toBe(
      '1 g de beurre'
    )
  })

  it('arrondit aussi les centilitres', () => {
    expect(quantiteAffichee({ ...base, facteur: 0.3, libelle: '20 cl de crème' }).texte).toBe(
      '6 cl de crème'
    )
  })
})

describe('ui/quantites — les cuillères passent au verre doseur', () => {
  it('au-delà de quatre cuillères à soupe, bascule en centilitres', () => {
    // Compter neuf cuillères est une corvée et une source d'erreur ; 9 cl se lisent sur un doseur.
    expect(
      quantiteAffichee({ ...base, facteur: 3, libelle: "2 cuillères à soupe d'huile" }).texte
    ).toBe("9 cl d'huile")
  })

  it('garde la cuillère en dessous du seuil — personne ne sort un doseur pour 1,5 cl', () => {
    expect(
      quantiteAffichee({ ...base, facteur: 2, libelle: "2 cuillères à soupe d'huile" }).texte
    ).toBe("4 cuillères à soupe d'huile")
  })

  it('connaît la cuillère à café, trois fois plus petite', () => {
    expect(
      quantiteAffichee({ ...base, facteur: 6, libelle: '1 cuillère à café de miel' }).texte
    ).toBe('3 cl de miel')
  })

  it('accepte l’abréviation « c. à soupe »', () => {
    expect(quantiteAffichee({ ...base, facteur: 5, libelle: '2 c. à soupe de crème' }).texte).toBe(
      '15 cl de crème'
    )
  })
})

describe('ui/quantites — ce qui se COMPTE s’arrondit au quart', () => {
  it('remplace « 0,13 citron » par un quart de citron', () => {
    // Le cas signalé : une recette pour 8 ramenée à 1 portion. « 0,13 citron » n'est pas
    // actionnable ; « ¼ citron » l'est.
    expect(quantiteAffichee({ ...base, facteur: 0.125, libelle: '1 citron' }).texte).toBe('¼ citron')
  })

  it('ne descend jamais sous le quart', () => {
    expect(quantiteAffichee({ ...base, facteur: 0.01, libelle: '1 citron' }).texte).toBe('¼ citron')
  })

  it('arrondit au quart le plus proche', () => {
    expect(quantiteAffichee({ ...base, facteur: 0.6, libelle: '4 artichauts' }).texte).toBe(
      '2 ½ artichauts'
    )
  })

  it('laisse les comptes entiers intacts', () => {
    expect(quantiteAffichee({ ...base, facteur: 2, libelle: '4 artichauts' }).texte).toBe(
      '8 artichauts'
    )
  })
})

describe('formaterQuantiteAchat', () => {
  it('accorde au pluriel ce qui se compte à partir de deux', () => {
    expect(formaterQuantiteAchat(3, 'pièce', null)).toBe('3 pièces')
  })

  it('garde le singulier à un — le cas que l’ancien affichage brut ratait', () => {
    expect(formaterQuantiteAchat(1, 'pièce', null)).toBe('1 pièce')
  })

  it('affiche une masse simple sans conditionnement en grammes', () => {
    expect(formaterQuantiteAchat(350, 'g', null)).toBe('350 g')
  })

  it('bascule en kilos au-delà de mille grammes', () => {
    const texte = formaterQuantiteAchat(1000, 'g', 1000)
    expect(texte).toContain('1 kg')
    expect(texte).not.toContain('1000 g')
  })

  it('annonce le nombre de paquets à partir de deux conditionnements', () => {
    expect(formaterQuantiteAchat(500, 'g', 250)).toBe('500 g (2 × 250 g)')
  })

  it('un seul paquet ne s’annonce pas — « 1 × 250 g » n’apprendrait rien', () => {
    const texte = formaterQuantiteAchat(250, 'g', 250)
    expect(texte).toBe('250 g')
    expect(texte).not.toContain('×')
  })

  it('combine kilos et nombre de paquets', () => {
    const texte = formaterQuantiteAchat(1500, 'g', 750)
    expect(texte).toContain('1,5 kg')
    expect(texte).toContain('2 × 750 g')
  })

  it('un conditionnement nul ou négatif n’ajoute aucune parenthèse et ne divise jamais par zéro', () => {
    expect(formaterQuantiteAchat(500, 'g', 0)).toBe('500 g')
    expect(formaterQuantiteAchat(500, 'g', -250)).toBe('500 g')
  })
})
