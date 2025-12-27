// Test fixture for string interpolation with ternary operators
def updateAmmoDisplay(currentAmount: int, reserveAmount: int)
    self.ammoValue.text = currentAmount == -1 ? "∞" : "{max(currentAmount, 0)}"
    self.clipValue.text = reserveAmount == -1 ? "∞" : "{max(reserveAmount, 0)}"

    self.mainWeaponSlot.name.nodeId.isActive = false
    return


// Test nested interpolated strings
def foo()
    // Nested string in ternary operator inside interpolation
    print("Ammo: {currentAmount == -1 ? "∞" : "{max(currentAmount, 0)}"}")
    
    // Multiple nested strings in ternary
    print("Status: {isActive ? "Active" : "Inactive"}")
    
    // Nested interpolation with multiple levels
    print("Result: {x > 0 ? "positive: {x}" : "non-positive"}")
    
    // Complex nested case with single quotes inside
    print("Value: {flag ? "yes" : 'no'}")
    
    // Multiple ternaries with nested strings
    print("Health: {hp == -1 ? "∞" : "{hp}"} / Shield: {shield == -1 ? "∞" : "{shield}"}")
    
    // Nested string with escape sequences
    print("Message: {error ? "Error:\n{errorMsg}" : "OK"}")
    
    // Deeply nested case
    print("Deep: {a ? "{b ? "inner" : "middle"}" : "outer"}")


// Test multiline string interpolation
def testMultilineStringInterpolation(eid, reEid: uint)
    // Multiline string with interpolation
    print("[Item Equipment] initial_loadout_item removed
itemEid={get_entity_info(eid)}
reEid={get_entity_info(reEid)}")
    
    // Another multiline case
    let message = "Status:
Health: {hp}
Shield: {shield}
Active: {isActive}"
    
    // Multiline with nested strings
    print("Report:
{status ? "OK" : "ERROR"}
Details: {details}")