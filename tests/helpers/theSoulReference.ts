// Verbatim port of TheSoul's `performAnalysis` text loop (index.html, SpectralPack/TheSoul).
// Only changes: inputs are parameters instead of DOM reads, `Immolate` is passed in, and the
// text is returned instead of written to a textarea. Leaks (un-deleted temporaries) are kept as-is.

export interface TheSoulInputs {
  ante: number;
  cardsPerAnte: number[];
  deck: string;
  stake: string;
  version: number;
  seed: string;
  options: readonly string[];
  selectedOptions: boolean[];
}

export function theSoulReferenceText(Immolate: any, input: TheSoulInputs): string {
  const ante = input.ante;
  const cardsPerAnte = input.cardsPerAnte;
  const deck = input.deck;
  const stake = input.stake;
  const version = input.version;
  const seed = input.seed.toUpperCase().replace(/0/g, 'O');
  const options = input.options;
  const selectedOptions = input.selectedOptions;

  let output = "";

  // It's analysis time!
  var inst = new Immolate.Instance(seed);
  inst.params = new Immolate.InstParams(deck, stake, false, version);
  inst.initLocks(1, false, false);
  inst.lock("Overstock Plus");
  inst.lock("Liquidation");
  inst.lock("Glow Up");
  inst.lock("Reroll Glut");
  inst.lock("Omen Globe");
  inst.lock("Observatory");
  inst.lock("Nacho Tong");
  inst.lock("Recyclomancy");
  inst.lock("Tarot Tycoon");
  inst.lock("Planet Tycoon");
  inst.lock("Money Tree");
  inst.lock("Antimatter");
  inst.lock("Illusion");
  inst.lock("Petroglyph");
  inst.lock("Retcon");
  inst.lock("Palette");
  for (let i = 0; i < options.length; i++) {
    if (selectedOptions[i] == false) inst.lock(options[i]);
  }
  inst.setStake(stake);
  inst.setDeck(deck);
  var ghostDeck = (deck == "Ghost Deck");
  void ghostDeck;
  for (let a = 1; a <= ante; a++) {
    inst.initUnlocks(a, false);
    output += "==ANTE " + a + "==\n"
    output += "Boss: " + inst.nextBoss(a) + "\n";
    var voucher = inst.nextVoucher(a);
    output += "Voucher: " + voucher + "\n";
    inst.lock(voucher);
    // Unlock next level voucher
    for (let i = 0; i < Immolate.VOUCHERS.size(); i+=2) {
        if (Immolate.VOUCHERS.get(i) == voucher) {
            // Only unlock it if it's unlockable
            if (selectedOptions[options.indexOf(Immolate.VOUCHERS.get(i+1))]) {
              inst.unlock(Immolate.VOUCHERS.get(i+1));
            };
        };
    };
    output += "Tags: " + inst.nextTag(a) + ", " + inst.nextTag(a) + "\n";

    output += "Shop Queue: \n";
    for (let q = 1; q <= cardsPerAnte[a-1]!; q++) {
      output += q + ") ";
      var item = inst.nextShopItem(a);
      if (item.type == "Joker") {
        if (item.jokerData.stickers.eternal) output += "Eternal ";
        if (item.jokerData.stickers.perishable) output += "Perishable ";
        if (item.jokerData.stickers.rental) output += "Rental ";
        if (item.jokerData.edition != "No Edition") output += item.jokerData.edition + " ";
      }
      output += item.item + "\n";
      item.delete();
    }

    output += "\nPacks: \n";
    var numPacks = (a == 1) ? 4 : 6;
    for (let p = 1; p <= numPacks; p++) {
      var pack = inst.nextPack(a);
      output += pack + " - ";
      var packInfo = Immolate.packInfo(pack);
      if (packInfo.type == "Celestial Pack") {
        var cards = inst.nextCelestialPack(packInfo.size, a);
        for (let c = 0; c < packInfo.size; c++) {
          output += cards.get(c);
          output += (c + 1 != packInfo.size) ? ", " : "";
        }
        cards.delete();
      }
      if (packInfo.type == "Arcana Pack") {
        var cards = inst.nextArcanaPack(packInfo.size, a);
        for (let c = 0; c < packInfo.size; c++) {
          output += cards.get(c);
          output += (c + 1 != packInfo.size) ? ", " : "";
        }
        cards.delete();
      }
      if (packInfo.type == "Spectral Pack") {
        var cards = inst.nextSpectralPack(packInfo.size, a);
        for (let c = 0; c < packInfo.size; c++) {
          output += cards.get(c);
          output += (c + 1 != packInfo.size) ? ", " : "";
        }
        cards.delete();
      }
      if (packInfo.type == "Buffoon Pack") {
        var cards = inst.nextBuffoonPack(packInfo.size, a);
        for (let c = 0; c < packInfo.size; c++) {
          var joker = cards.get(c);
          if (joker.stickers.eternal) output += "Eternal ";
          if (joker.stickers.perishable) output += "Perishable ";
          if (joker.stickers.rental) output += "Rental ";
          if (joker.edition != "No Edition") output += joker.edition + " ";
          output += joker.joker;
          joker.delete();
          output += (c + 1 != packInfo.size) ? ", " : "";
        }
        cards.delete();
      }
      if (packInfo.type == "Standard Pack") {
        var cards = inst.nextStandardPack(packInfo.size, a);
        for (let c = 0; c < packInfo.size; c++) {
          var card = cards.get(c);
          if (card.seal != "No Seal") output += card.seal + " ";
          if (card.edition != "No Edition") output += card.edition + " ";
          if (card.enhancement != "No Enhancement") output += card.enhancement + " ";
          var rank = card.base[2];
          if (rank == "T") output += "10";
          else if (rank == "J") output += "Jack";
          else if (rank == "Q") output += "Queen";
          else if (rank == "K") output += "King";
          else if (rank == "A") output += "Ace";
          else output += rank;
          output += " of ";
          var suit = card.base[0];
          if (suit == "C") output += "Clubs";
          else if (suit == "S") output += "Spades";
          else if (suit == "D") output += "Diamonds";
          else if (suit == "H") output += "Hearts";
          card.delete();
          output += (c + 1 != packInfo.size) ? ", " : "";
        }
        cards.delete();
      }
      output += "\n";
    }

    output += "\n";
  };

  inst.delete();

  return output;
}
