export class SimulationTick {
  static processBiologicalTick(characters, elapsedHours = 3) {
    const hungerIncreaseRate = 2;
    for (const char of characters.values()) {
      if (!char.physical) continue;
      char.physical.hunger = Math.min(100, (char.physical.hunger || 0) + (elapsedHours * hungerIncreaseRate));
      if (char.physical.hunger >= 80) {
        char.physical.hp = Math.max(0, (char.physical.hp || 100) - 5);
      }
    }
  }

  static applyDelta(characters, delta = {}) {
    if (delta.location_changes) {
      for (const [charId, newLoc] of Object.entries(delta.location_changes)) {
        const char = characters.get(charId);
        if (char) char.current_location = newLoc;
      }
    }
    if (delta.hp_changes) {
      for (const [charId, hpDiff] of Object.entries(delta.hp_changes)) {
        const char = characters.get(charId);
        if (char && char.physical) {
          char.physical.hp = Math.max(0, Math.min(100, (char.physical.hp || 100) + hpDiff));
        }
      }
    }
    if (delta.stress_changes) {
      for (const [charId, stressDiff] of Object.entries(delta.stress_changes)) {
        const char = characters.get(charId);
        if (char && char.psychological) {
          char.psychological.stress = Math.max(0, Math.min(100, (char.psychological.stress || 0) + stressDiff));
        }
      }
    }
    if (delta.inventory_additions) {
      for (const [charId, items] of Object.entries(delta.inventory_additions)) {
        const char = characters.get(charId);
        if (char && char.physical) {
          char.physical.inventory = [...(char.physical.inventory || []), ...items];
        }
      }
    }
  }
}
