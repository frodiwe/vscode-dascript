// Test to ensure "module" keyword doesn't match within identifiers

// Proper module declarations (should be highlighted as keyword)
module test_module public
module another_module private shared

// Variables containing "module" should NOT highlight "module" as keyword
var modulesIncludes : table<string>
var moduleList : array<string>
var mymodule : int
var submoduleCount : int = 0

// Function names containing "module"
def getModuleInfo()
    pass

def loadModules(moduleNames : array<string>)
    pass

// Struct with "module" in name
struct ModuleConfig
    modulePath : string
    moduleVersion : int
