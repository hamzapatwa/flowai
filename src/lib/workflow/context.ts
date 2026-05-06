export class WorkflowContext {
  private stepData: Record<string, Record<string, unknown>> = {};

  constructor(initialTriggerOutput?: Record<string, unknown>) {
    if (initialTriggerOutput) {
      this.stepData.trigger = initialTriggerOutput;
    }
  }

  setStepOutput(nodeId: string, output: Record<string, unknown>) {
    this.stepData[nodeId] = output;
  }

  getStepOutput(nodeId: string) {
    return this.stepData[nodeId];
  }

  allStepData() {
    return this.stepData;
  }

  interpolate(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.replace(
        /\{\{\s*([\w-]+)\.([\w.]+)\s*\}\}/g,
        (_, nodeId: string, path: string) => {
          const stepOutput = this.stepData[nodeId];
          if (!stepOutput) return '';
          const parts = path.split('.');
          let cur: unknown = stepOutput;
          for (const part of parts) {
            if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
              cur = (cur as Record<string, unknown>)[part];
            } else {
              return '';
            }
          }
          if (cur === null || cur === undefined) return '';
          return typeof cur === 'object' ? JSON.stringify(cur) : String(cur);
        }
      );
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.interpolate(v));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          this.interpolate(v),
        ])
      );
    }
    return value;
  }
}
