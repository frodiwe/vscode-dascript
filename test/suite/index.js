const path = require('path');
const Mocha = require('mocha');
const { glob } = require('glob');

async function run() {
    const mocha = new Mocha({
        ui: 'bdd',
        color: true
    });

    const testsRoot = path.resolve(__dirname, '.');

    try {
        const files = await glob('**/**.test.js', { cwd: testsRoot });
        
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

        return new Promise((resolve, reject) => {
            try {
                // Load files to set up Mocha globals before running
                mocha.loadFiles();
                
                mocha.run(failures => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    } catch (err) {
        throw err;
    }
}

module.exports = { run };
