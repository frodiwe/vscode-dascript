// Test fixture for tuple type declarations

// Basic tuple in array
var victimNodes : array<tuple< node : NodeId, timeBeforeDamage : float>>

// Simple tuple variable
var position : tuple<x : float, y : float, z : float>

// Tuple with mixed types
var playerData : tuple<name : string, health : int, position : float3>

// Nested template types in tuple
var complexData : tuple<items : array<string>, count : int, valid : bool>

// Tuple in function parameter
def processVictim(victim : tuple<node : NodeId, damage : float>)
    pass

// Tuple return type
def getCoordinates() : tuple<x : int, y : int>
    return [[tuple<x : int, y : int> x=0, y=0]]
