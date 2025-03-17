import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

// Define metrics data structure
interface MetricsData {
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
  transitionSuccess: boolean | null;
  keyRotationSuccess: boolean | null;
  securityChecks: {
    didControllerVerified: boolean[];
    properAuthorizationForTransition: boolean[];
  };
}

// Initialize metrics object
const metrics: MetricsData = {
  resolutionTimes: {
    withoutRedirect: [],
    withRedirect: [],
  },
  verificationTimes: {
    beforeTransition: [],
    afterTransition: [],
    afterKeyRotation: [],
  },
  verificationResults: {
    beforeTransition: [],
    afterTransition: [],
    afterKeyRotation: [],
  },
  transitionSuccess: null,
  keyRotationSuccess: null,
  securityChecks: {
    didControllerVerified: [],
    properAuthorizationForTransition: [],
  },
};

// Metrics collection functions
export const didMetrics = {
  // Measure DID resolution time
  async measureResolutionTime(
    resolveFunc: () => Promise<any>,
    isRedirect: boolean
  ): Promise<any> {
    const start = performance.now();
    try {
      const result = await resolveFunc();
      const end = performance.now();
      const duration = end - start;
      
      if (isRedirect) {
        metrics.resolutionTimes.withRedirect.push(duration);
      } else {
        metrics.resolutionTimes.withoutRedirect.push(duration);
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  },

  // Measure credential verification time and record result
  async measureVerificationTime(
    verifyFunc: () => Promise<any>,
    phase: 'beforeTransition' | 'afterTransition' | 'afterKeyRotation'
  ): Promise<any> {
    const start = performance.now();
    try {
      const result = await verifyFunc();
      const end = performance.now();
      const duration = end - start;
      
      metrics.verificationTimes[phase].push(duration);
      metrics.verificationResults[phase].push(result.isValid);
      
      return result;
    } catch (error) {
      metrics.verificationResults[phase].push(false);
      throw error;
    }
  },

  // Record transition outcome
  recordTransitionSuccess(success: boolean): void {
    metrics.transitionSuccess = success;
  },

  // Record key rotation outcome
  recordKeyRotationSuccess(success: boolean): void {
    metrics.keyRotationSuccess = success;
  },

  // Record security check results
  recordSecurityCheck(
    type: 'didControllerVerified' | 'properAuthorizationForTransition',
    success: boolean
  ): void {
    metrics.securityChecks[type].push(success);
  },

  // Save metrics to JSON file
  async saveMetrics(): Promise<void> {
    const metricsOutput = {
      ...metrics,
      summary: {
        avgResolutionTimeWithoutRedirect: metrics.resolutionTimes.withoutRedirect.length > 0 ? 
          metrics.resolutionTimes.withoutRedirect.reduce((a, b) => a + b, 0) / metrics.resolutionTimes.withoutRedirect.length : 
          null,
        avgResolutionTimeWithRedirect: metrics.resolutionTimes.withRedirect.length > 0 ? 
          metrics.resolutionTimes.withRedirect.reduce((a, b) => a + b, 0) / metrics.resolutionTimes.withRedirect.length : 
          null,
        resolutionOverhead: metrics.resolutionTimes.withRedirect.length > 0 && metrics.resolutionTimes.withoutRedirect.length > 0 ? 
          (metrics.resolutionTimes.withRedirect.reduce((a, b) => a + b, 0) / metrics.resolutionTimes.withRedirect.length) / 
          (metrics.resolutionTimes.withoutRedirect.reduce((a, b) => a + b, 0) / metrics.resolutionTimes.withoutRedirect.length) : 
          null,
        verificationSuccessRateBeforeTransition: metrics.verificationResults.beforeTransition.length > 0 ?
          metrics.verificationResults.beforeTransition.filter(v => v).length / metrics.verificationResults.beforeTransition.length * 100 :
          null,
        verificationSuccessRateAfterTransition: metrics.verificationResults.afterTransition.length > 0 ?
          metrics.verificationResults.afterTransition.filter(v => v).length / metrics.verificationResults.afterTransition.length * 100 :
          null,
        verificationSuccessRateAfterKeyRotation: metrics.verificationResults.afterKeyRotation.length > 0 ?
          metrics.verificationResults.afterKeyRotation.filter(v => v).length / metrics.verificationResults.afterKeyRotation.length * 100 :
          null,
        securityCheckSuccessRate: metrics.securityChecks.didControllerVerified.length > 0 ?
          metrics.securityChecks.didControllerVerified.filter(v => v).length / metrics.securityChecks.didControllerVerified.length * 100 :
          null,
      },
      timestamp: new Date().toISOString(),
      didMethods: process.env.DEMO_DID_METHODS || 'unknown'
    };

    try {
      const metricsDir = path.join(process.cwd(), 'metrics');
      await fs.mkdir(metricsDir, { recursive: true });
      
      const filename = `metrics_${process.env.DEMO_DID_METHODS || 'unknown'}_${Date.now()}.json`;
      await fs.writeFile(
        path.join(metricsDir, filename),
        JSON.stringify(metricsOutput, null, 2)
      );
      
      console.log(`Metrics saved to ${filename}`);
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }
};