import { RuleNode, Candidate } from '../../types';

/**
 * Evaluates a candidate against a rule tree.
 * @param candidate The candidate data object (flattened or structured).
 * @param rule The root node of the rule DSL.
 * @returns boolean indicating pass/fail.
 */
export const evaluateRule = (candidate: any, rule: RuleNode): boolean => {
  if (rule.type === 'group') {
    if (!rule.children || rule.children.length === 0) return true;

    if (rule.operator === 'AND') {
      return rule.children.every(child => evaluateRule(candidate, child));
    } else if (rule.operator === 'OR') {
      return rule.children.some(child => evaluateRule(candidate, child));
    } else if (rule.operator === 'NOT') {
      // Assumes single child for NOT
      return !evaluateRule(candidate, rule.children[0]);
    }
    return false;
  }

  if (rule.type === 'condition') {
    const candidateValue = getNestedValue(candidate, rule.field || '');
    const ruleValue = rule.value;

    switch (rule.operator) {
      case 'EQUALS':
        return candidateValue == ruleValue; // Loose equality for string/number mixing
      case 'GTE':
        return Number(candidateValue) >= Number(ruleValue);
      case 'LTE':
        return Number(candidateValue) <= Number(ruleValue);
      case 'CONTAINS':
        if (Array.isArray(candidateValue)) {
            return candidateValue.includes(ruleValue);
        }
        return String(candidateValue).toLowerCase().includes(String(ruleValue).toLowerCase());
      default:
        return false;
    }
  }

  return false;
};

// Helper to access "experience.years" from object
const getNestedValue = (obj: any, path: string) => {
  return path.split('.').reduce((prev, curr) => prev ? prev[curr] : null, obj);
};

// Example DSL for testing
export const DEFAULT_ENGINEER_RULE: RuleNode = {
  id: 'root',
  type: 'group',
  operator: 'AND',
  children: [
    {
      id: 'c1',
      type: 'condition',
      field: 'experience_years',
      operator: 'GTE',
      value: 3
    },
    {
      id: 'c2',
      type: 'condition',
      field: 'skills',
      operator: 'CONTAINS',
      value: 'React'
    }
  ]
};
