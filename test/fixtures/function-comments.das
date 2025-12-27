// Test fixture for comments in function definitions
// Comments after return types should be highlighted as comments, not types

def abstract write ( bytes:void? implicit; size:int ) : bool    //! Write binary data to stream.

def read ( buffer:void? implicit; size:int ) : int    //! Read data from stream.

def close ( ) : void    //! Close the stream and release resources.

def open ( filename:string; mode:string ) : bool    // Open file with given mode

def process ( data:array<int>; count:int ) : void    /* Process array data */

def calculate ( x:float; y:float ) : float    // Calculate result

def getData ( ) : CombatUI?    //! Returns optional CombatUI instance

def transform ( input:float3 ) : float4    //! Transform 3D vector to 4D

def isValid ( value:int64 ) : bool    // Check if value is valid

def getName ( ) : string    //! Get the name property
