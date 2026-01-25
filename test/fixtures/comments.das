// Test fixture for comment syntax highlighting
// Comments should not have syntax highlighting inside them

// var hitboxNode = NodeId()
// if (hitbox != "") {
//     let hitboxes = get_child(dynamics.nodeId, "hitboxes")
//     if (!!hitboxes) {
//         hitboxNode = find_child(hitboxes, hitbox)
//     }
// }

var actualCode = 42

// function test() : int
// return someFunction(param1, param2)

/* Block comment with syntax
   var x : int = 10
   if (x > 5) {
       return true
   }
*/

var moreCode = "string"

/* Multi-line with keywords
function someFunc(var self : SomeType, param : int) : bool
    let value = getValue()
    return value > 0
*/

// Single line with types: CombatUI? quat4 float3 int string
// Keywords: var let function return if else for while
// Operators: += -= *= /= == != <= >= && || ?? ?. <| |>

// Test apostrophes in comments - these should NOT be treated as strings
// It's better than declaring typ as var.
// Don't use this approach
// The player's health shouldn't go below zero

// Code with comment containing apostrophe
clear(unsafe(reinterpret<TypeDecl?> typ.get_ptr()).dim) // It's better than declaring typ as var.
