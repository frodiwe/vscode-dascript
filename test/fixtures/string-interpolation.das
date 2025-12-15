// Test fixture for string interpolation with ternary operators
def updateAmmoDisplay(currentAmount: int, reserveAmount: int)
    self.ammoValue.text = currentAmount == -1 ? "∞" : "{max(currentAmount, 0)}"
    self.clipValue.text = reserveAmount == -1 ? "∞" : "{max(reserveAmount, 0)}"

    self.mainWeaponSlot.name.nodeId.isActive = false
    return
