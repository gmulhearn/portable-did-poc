import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFile = fileURLToPath(import.meta.url);

interface MetricsSummary {
  avgResolutionTimeWithoutRedirect: number | null;
  avgResolutionTimeWithRedirect: number | null;
  resolutionOverhead: number | null;
  verificationSuccessRateBeforeTransition: number | null;
  verificationSuccessRateAfterTransition: number | null;
  verificationSuccessRateAfterKeyRotation: number | null;
  securityCheckSuccessRate: number | null;
}

interface MetricsReport {
  didMethods: string;
  timestamp: string;
  summary: MetricsSummary;
  transitionSuccess: boolean | null;
  keyRotationSuccess: boolean | null;
  // Add other properties from your metrics structure that might be needed
  resolutionTimes: {
    withoutRedirect: number[];
    withRedirect: number[];
  };
  verificationTimes: {
    beforeTransition: number[];
    afterTransition: number[];
    afterKeyRotation: number[];
  };
  verificationResults: {
    beforeTransition: boolean[];
    afterTransition: boolean[];
    afterKeyRotation: boolean[];
  };
  securityChecks: {
    didControllerVerified: boolean[];
    properAuthorizationForTransition: boolean[];
  };
}

async function generateReport() {
  try {
    // Read all metric files from the metrics directory
    const metricsDir = path.join(process.cwd(), 'metrics');
    const files = await fs.readdir(metricsDir);
    const metricFiles = files.filter(file => file.startsWith('metrics_') && file.endsWith('.json'));

    // Group metrics by DID method
    const metricsByMethod: Record<string, MetricsReport[]> = {};
    
    for (const file of metricFiles) {
      const content = await fs.readFile(path.join(metricsDir, file), 'utf8');
      const metrics = JSON.parse(content) as MetricsReport;
      
      if (!metricsByMethod[metrics.didMethods]) {
        metricsByMethod[metrics.didMethods] = [];
      }
      metricsByMethod[metrics.didMethods].push(metrics);
    }

    // Generate comparative report
    let report = '# DID Portability Performance Report\n\n';
    report += `Generated on: ${new Date().toLocaleString()}\n\n`;
    
    // Overview table
report += '## Overview\n\n';
report += '| DID Method | Avg Resolution Time | Resolution Time (with redirect) | Resolution Overhead | Verification Success Rate (After Transition) | Security Check Pass Rate |\n';
report += '|------------|---------------------|--------------------------------|---------------------|---------------------------------------------|---------------------------|\n';

for (const [method, metrics] of Object.entries(metricsByMethod)) {
  // Calculate averages across all runs for this method
  const avgResolutionTime = metrics
    .map(m => m.summary.avgResolutionTimeWithoutRedirect)
    .filter((t): t is number => t !== null)
    .reduce((sum, time) => sum + time, 0) / metrics.length;
    
  const avgResolutionTimeWithRedirect = metrics
    .map(m => m.summary.avgResolutionTimeWithRedirect)
    .filter((t): t is number => t !== null)
    .reduce((sum, time) => sum + time, 0) / metrics.length;
    
  const avgResolutionOverhead = metrics
    .map(m => m.summary.resolutionOverhead)
    .filter((t): t is number => t !== null)
    .reduce((sum, overhead) => sum + overhead, 0) / metrics.length;
    
  const avgVerificationSuccessRate = metrics
    .map(m => m.summary.verificationSuccessRateAfterTransition)
    .filter((t): t is number => t !== null)
    .reduce((sum, rate) => sum + rate, 0) / metrics.length;
    
  const avgSecurityCheckRate = metrics
    .map(m => m.summary.securityCheckSuccessRate)
    .filter((t): t is number => t !== null)
    .reduce((sum, rate) => sum + rate, 0) / metrics.length;
  
  report += `| ${method} | ${avgResolutionTime.toFixed(2)}ms | ${avgResolutionTimeWithRedirect.toFixed(2)}ms | ${avgResolutionOverhead.toFixed(2)}x | ${avgVerificationSuccessRate.toFixed(2)}% | ${avgSecurityCheckRate.toFixed(2)}% |\n`;
}
    
    // Detailed analysis for each method
    for (const [method, metrics] of Object.entries(metricsByMethod)) {
      report += `\n## ${method} Method Analysis\n\n`;
      
      // Get the latest metrics for this method
      const latestMetrics = metrics.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
      
      report += '### Performance\n\n';
      report += `- Resolution Time (without redirect): ${latestMetrics.summary.avgResolutionTimeWithoutRedirect?.toFixed(2) || 'N/A'} ms\n`;
      report += `- Resolution Time (with redirect): ${latestMetrics.summary.avgResolutionTimeWithRedirect?.toFixed(2) || 'N/A'} ms\n`;
      report += `- Resolution Overhead: ${latestMetrics.summary.resolutionOverhead?.toFixed(2) || 'N/A'}x\n\n`;
      
      report += '### Verification Success Rates\n\n';
      report += `- Before Transition: ${latestMetrics.summary.verificationSuccessRateBeforeTransition?.toFixed(2) || 'N/A'}%\n`;
      report += `- After Transition: ${latestMetrics.summary.verificationSuccessRateAfterTransition?.toFixed(2) || 'N/A'}%\n`;
      report += `- After Key Rotation: ${latestMetrics.summary.verificationSuccessRateAfterKeyRotation?.toFixed(2) || 'N/A'}%\n\n`;
      
      report += '### Transition Status\n\n';
      const transitionSuccess = metrics.every(m => m.transitionSuccess === true);
      const keyRotationSuccess = metrics.every(m => m.keyRotationSuccess === true);
      
      report += `- DID Transition: ${transitionSuccess ? '✅ Working' : '❌ Issues Detected'}\n`;
      report += `- Key Rotation: ${keyRotationSuccess ? '✅ Working' : '❌ Issues Detected'}\n\n`;
      
      report += '### Security Checks\n\n';
      report += `- Security Check Pass Rate: ${latestMetrics.summary.securityCheckSuccessRate?.toFixed(2) || 'N/A'}%\n`;
    }
    
    // Save report
    await fs.writeFile(path.join(metricsDir, 'performance_report.md'), report);
    console.log(`Report generated at ${path.join(metricsDir, 'performance_report.md')}`);
    
  } catch (error) {
    console.error('Failed to generate report:', error);
  }
}

// Allow running directly
if (currentFile === process.argv[1]) {
    generateReport().catch(console.error);
  }
  
  export { generateReport };