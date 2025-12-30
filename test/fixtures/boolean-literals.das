// Test file for boolean literal highlighting
// Booleans should always be highlighted as constant.language.dascript

def test_booleans()
    // Boolean in variable assignment
    let isActive = true
    let isDisabled = false

    // Boolean in function arguments
    send_message(gameClient, true)
    set_state(entity, false, true)

    // Boolean in complex function call (like the user's example)
    send_client_to_server_msg(gameClient, WeaponShotPlayerToServer(
        state = WeaponShotPlayerState(
            hitOrigin = vec3(1.0, 2.0, 3.0),
            damage = 10.0,
            armorDamage = 0.
        ),
        syncTime = get_sync_time()
    ), true)

    // Boolean in if statements
    if true
        return false

    // Boolean in ternary operators
    let result = condition ? true : false

    // Boolean with null
    let nullValue = null
    let hasValue = value != null ? true : false

// Test for variable assignment without var/let (reassignment)
def test_variable_reassignment()
    var voidRoutine = true
    var someCounter = 0
    var playerName = "test"
    var isEnabled = true
    
    // Reassignment without var/let - variable names should NOT be highlighted as types
    voidRoutine = false
    someCounter = 10
    playerName = "updated"
    isEnabled = false
    
    // Reassignment with expressions
    voidRoutine = someCounter > 5
    someCounter = someCounter + 1
    
    // Multiple assignments
    voidRoutine = false
    voidRoutine = true
    voidRoutine = !voidRoutine
