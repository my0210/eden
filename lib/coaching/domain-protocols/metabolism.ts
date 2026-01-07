/**
 * Metabolism Domain Protocol Template
 * 
 * Focus: Glucose stability, metabolic flexibility, blood markers
 * Evidence-based approach for metabolic health
 * 
 * Note: Fasting protocols are NOT included as default - they're an optional module
 * requiring screening (no ED history, not underweight, not in high training phase)
 */

import { DomainTemplate } from './types'

export const metabolismTemplate: DomainTemplate = {
  id: 'metabolism',
  version: 1,
  name: 'Metabolism',
  preview: 'Blood sugar stability and metabolic flexibility',
  
  focusAreas: [
    'Blood glucose stability',
    'Protein intake optimization',
    'Fiber and micronutrient intake',
    'Meal timing and energy management',
  ],
  
  phases: [
    {
      number: 1,
      name: 'Awareness',
      durationWeeks: 4,
      focus: 'Build awareness of eating patterns and blood sugar responses',
      successCriteria: 'Track meals consistently, identify patterns',
    },
    {
      number: 2,
      name: 'Optimize',
      durationWeeks: 4,
      focus: 'Implement changes based on learnings',
      successCriteria: 'Hit protein targets, reduce blood sugar spikes',
    },
    {
      number: 3,
      name: 'Sustain',
      durationWeeks: 4,
      focus: 'Lock in habits, fine-tune based on results',
      successCriteria: 'Maintain improvements with minimal tracking',
    },
  ],
  
  actionTemplates: [
    {
      id: 'protein_first',
      title: 'Protein-First Meals',
      description: 'Start each main meal with protein (20-40g). Protein blunts glucose response and increases satiety.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'flexible',
      },
      targetMetric: 'hba1c',
      successCriteria: 'Hit daily protein target (1.6g/kg minimum)',
      phases: [1, 2, 3],
      personalizationHints: [
        'Calculate protein target based on bodyweight',
        'Suggest protein sources based on diet preferences',
      ],
    },
    {
      id: 'fiber_target',
      title: 'Hit Fiber Target',
      description: 'Aim for 25-35g fiber daily from vegetables, fruits, legumes, and whole grains. Fiber improves glucose response and gut health.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'flexible',
      },
      targetMetric: 'hba1c',
      successCriteria: 'Consistently hit fiber target',
      phases: [1, 2, 3],
    },
    {
      id: 'post_meal_walk',
      title: 'Post-Meal Movement',
      description: 'Take a 10-15 minute walk after your largest meal. Even light movement significantly reduces glucose spikes.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'afternoon',
      },
      targetMetric: 'hba1c',
      fallback: '5 minutes of light movement or standing',
      phases: [1, 2, 3],
    },
    {
      id: 'meal_awareness',
      title: 'Log Main Meals',
      description: 'Track what you eat at main meals - just awareness, not calorie counting. Note how you feel after.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'flexible',
      },
      phases: [1],
      personalizationHints: [
        'Can use app or simple notes',
        'Focus on patterns, not perfection',
      ],
    },
    {
      id: 'veggie_servings',
      title: 'Eat Vegetables with 2+ Meals',
      description: 'Include non-starchy vegetables with at least 2 meals daily. Aim for variety and color.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'flexible',
      },
      successCriteria: 'Vegetables at 2+ meals',
      phases: [1, 2, 3],
    },
    {
      id: 'hydration',
      title: 'Stay Hydrated',
      description: 'Drink adequate water throughout the day. Aim for clear/light yellow urine.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'flexible',
      },
      phases: [1, 2, 3],
    },
    {
      id: 'weekly_review',
      title: 'Weekly Nutrition Review',
      description: 'Review your eating patterns from the week. What worked? What needs adjustment?',
      type: 'action',
      defaultSchedule: {
        frequency: 'weekly',
        targetCount: 1,
        suggestedDays: ['Sunday'],
        preferredTime: 'evening',
      },
      phases: [1, 2, 3],
    },
  ],
  
  setupQuestions: [
    {
      id: 'diet_style',
      question: 'What\'s your current eating style?',
      type: 'single_choice',
      options: [
        { value: 'omnivore', label: 'Omnivore - I eat everything' },
        { value: 'vegetarian', label: 'Vegetarian' },
        { value: 'vegan', label: 'Vegan' },
        { value: 'pescatarian', label: 'Pescatarian' },
        { value: 'keto_low_carb', label: 'Keto/Low-carb' },
        { value: 'other', label: 'Other specific diet' },
      ],
      impactsPersonalization: 'Adjusts food recommendations',
      required: true,
    },
    {
      id: 'glucose_concern',
      question: 'Do you have any blood sugar concerns?',
      type: 'single_choice',
      options: [
        { value: 'none', label: 'No known issues' },
        { value: 'prediabetes', label: 'Pre-diabetes or elevated glucose' },
        { value: 'diabetes_t2', label: 'Type 2 diabetes (managed)' },
        { value: 'reactive_hypo', label: 'Reactive hypoglycemia' },
      ],
      impactsPersonalization: 'Adjusts protocol intensity and recommendations',
      required: true,
    },
    {
      id: 'meal_frequency',
      question: 'How many meals do you typically eat per day?',
      type: 'single_choice',
      options: [
        { value: '2', label: '2 meals' },
        { value: '3', label: '3 meals' },
        { value: '3_snacks', label: '3 meals + snacks' },
        { value: 'grazing', label: 'Frequent small meals/grazing' },
      ],
      impactsPersonalization: 'Adjusts meal timing recommendations',
      required: true,
    },
    {
      id: 'cooking_ability',
      question: 'How would you describe your cooking situation?',
      type: 'single_choice',
      options: [
        { value: 'love_cooking', label: 'I enjoy cooking and do it often' },
        { value: 'can_cook', label: 'I can cook but prefer simple meals' },
        { value: 'minimal', label: 'Minimal cooking - mostly premade/eating out' },
        { value: 'no_kitchen', label: 'Limited kitchen access' },
      ],
      impactsPersonalization: 'Adjusts food prep recommendations',
      required: true,
    },
    {
      id: 'food_allergies',
      question: 'Any food allergies or intolerances?',
      type: 'text',
      impactsPersonalization: 'Excludes problematic foods from recommendations',
      required: false,
    },
    {
      id: 'primary_goal',
      question: 'Primary metabolism goal?',
      type: 'single_choice',
      options: [
        { value: 'energy', label: 'More stable energy throughout the day' },
        { value: 'weight', label: 'Weight management' },
        { value: 'markers', label: 'Improve blood markers (glucose, lipids)' },
        { value: 'general', label: 'General metabolic health' },
      ],
      impactsPersonalization: 'Focuses protocol on primary goal',
      required: true,
    },
  ],
  
  optionalModules: [
    {
      id: 'time_restricted_eating',
      name: 'Time-Restricted Eating',
      description: 'Compress eating window to 8-10 hours. Not fasting - just meal timing optimization.',
      screening: [
        {
          type: 'no_condition',
          condition: 'eating_disorder_history',
          description: 'No history of eating disorders',
        },
        {
          type: 'no_condition',
          condition: 'underweight',
          description: 'Not currently underweight (BMI > 18.5)',
        },
        {
          type: 'user_confirms',
          description: 'User confirms they want to try time-restricted eating',
        },
      ],
      actions: [
        {
          id: 'eating_window',
          title: 'Maintain Eating Window',
          description: 'Keep eating within your chosen window (e.g., 10am-6pm). No strict fasting - just consistent timing.',
          type: 'habit',
          defaultSchedule: {
            frequency: 'daily',
            targetCount: 7,
            preferredTime: 'flexible',
          },
          personalizationHints: [
            'Window based on user schedule',
            'Start with 10-hour window, can narrow later',
          ],
        },
      ],
    },
  ],
  
  safety: {
    contraindications: [
      'Active eating disorder',
      'Type 1 diabetes (requires medical supervision)',
      'Pregnancy or breastfeeding (nutritional changes need medical guidance)',
    ],
    beginnerIntensityCap: 'Focus on awareness and simple swaps only for first 4 weeks',
    warningSignals: [
      'Obsessive thoughts about food',
      'Anxiety around eating',
      'Significant unintended weight changes',
      'Persistent fatigue or weakness',
    ],
    seekProfessionalIf: [
      'Signs of disordered eating patterns',
      'Blood sugar frequently outside normal range',
      'Significant digestive issues',
      'Planning major dietary changes with existing conditions',
    ],
  },
}

