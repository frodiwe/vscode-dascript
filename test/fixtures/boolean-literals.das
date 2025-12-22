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
