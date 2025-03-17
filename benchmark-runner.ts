import { exec } from 'child_process';
import { promisify } from 'util';
import { generateReport } from './metrics-report.ts';
import { fileURLToPath } from 'url';

const currentFile = fileURLToPath(import.meta.url);

const execAsync = promisify(exec);

// DID methods to test
const DID_METHODS = ['sov-to-cheqd', 'web-to-web', 'cheqd-to-cheqd'];

// Number of runs per method
const RUNS_PER_METHOD = 3;

async function runBenchmarks() {
  console.log('Starting DID Portability Benchmarks');
  
  for (const method of DID_METHODS) {
    console.log(`\n---------------------------------------`);
    console.log(`Testing method: ${method}`);
    console.log(`---------------------------------------`);
    
    // Set environment variable for the method
    process.env.DEMO_DID_METHODS = method;
    
    for (let i = 0; i < RUNS_PER_METHOD; i++) {
      console.log(`\nRun ${i + 1}/${RUNS_PER_METHOD}`);
      
      try {
        // Run the demo script (will collect metrics internally)
        await execAsync('npm run dev');
        console.log(`✅ Run completed successfully`);
      } catch (error) {
        console.error(`❌ Run failed:`, error);
      }
    }
  }
  
  // Generate the final report
  await generateReport();
  console.log('\nBenchmarking complete. Report generated.');
}

// Allow running directly
if (currentFile === process.argv[1]) {
    runBenchmarks().catch(console.error);
}

export { runBenchmarks };