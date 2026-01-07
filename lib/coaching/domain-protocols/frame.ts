/**
 * Frame Domain Protocol Template
 * 
 * Focus: Progressive strength training, mobility, body composition
 * Evidence-based approach for structural health
 */

import { DomainTemplate } from './types'

export const frameTemplate: DomainTemplate = {
  id: 'frame',
  version: 1,
  name: 'Frame',
  preview: 'Progressive strength and mobility',
  
  focusAreas: [
    'Functional strength (push, pull, squat, hinge)',
    'Mobility and flexibility',
    'Body composition optimization',
    'Postural health',
  ],
  
  phases: [
    {
      number: 1,
      name: 'Foundation',
      durationWeeks: 4,
      focus: 'Build movement patterns and establish baseline strength',
      successCriteria: 'Complete 2-3 strength sessions per week with good form',
    },
    {
      number: 2,
      name: 'Build',
      durationWeeks: 4,
      focus: 'Progressive overload - increase weight or reps each week',
      successCriteria: 'Show measurable progress in key lifts',
    },
    {
      number: 3,
      name: 'Consolidate',
      durationWeeks: 4,
      focus: 'Lock in gains and address weaknesses',
      successCriteria: 'Maintain strength while improving mobility/weak points',
    },
  ],
  
  actionTemplates: [
    {
      id: 'strength_session',
      title: 'Strength Training Session',
      description: 'Full-body or split routine focusing on compound movements. Include warm-up, main lifts, and cool-down.',
      type: 'action',
      defaultSchedule: {
        frequency: '3x',
        targetCount: 3,
        suggestedDays: ['Monday', 'Wednesday', 'Friday'],
        preferredTime: 'flexible',
      },
      targetMetric: 'strength',
      successCriteria: 'Complete all sets with good form',
      fallback: 'Bodyweight circuit if no equipment available',
      phases: [1, 2, 3],
      personalizationHints: [
        'Exercise selection based on equipment available',
        'Volume based on experience level',
        'Split vs full-body based on time available',
      ],
    },
    {
      id: 'mobility_routine',
      title: 'Mobility Work',
      description: '10-15 minutes of targeted stretching and mobility exercises. Focus on hips, shoulders, and spine.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'evening',
      },
      targetMetric: 'structural_integrity',
      fallback: '5-minute hip opener sequence',
      phases: [1, 2, 3],
    },
    {
      id: 'posture_check',
      title: 'Posture Check',
      description: 'Set a reminder to check your posture throughout the day. Stand tall, shoulders back, engage core.',
      type: 'habit',
      defaultSchedule: {
        frequency: '3x',
        targetCount: 3,
        preferredTime: 'flexible',
      },
      targetMetric: 'structural_integrity',
      phases: [1, 2, 3],
    },
    {
      id: 'protein_target',
      title: 'Hit Protein Target',
      description: 'Aim for 1.6-2.2g protein per kg bodyweight to support muscle growth and recovery.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'flexible',
      },
      targetMetric: 'body_composition',
      successCriteria: 'Track protein intake and hit daily target',
      phases: [1, 2, 3],
      personalizationHints: [
        'Calculate target based on bodyweight',
        'Adjust for body composition goals',
      ],
    },
    {
      id: 'weekly_progress',
      title: 'Log Workout Progress',
      description: 'Record your lifts, reps, and how they felt. Track progression over time.',
      type: 'action',
      defaultSchedule: {
        frequency: 'weekly',
        targetCount: 1,
        preferredTime: 'flexible',
      },
      phases: [1, 2, 3],
    },
  ],
  
  setupQuestions: [
    {
      id: 'gym_access',
      question: 'What equipment do you have access to?',
      type: 'multi_choice',
      options: [
        { value: 'full_gym', label: 'Full gym (barbells, dumbbells, machines)' },
        { value: 'home_gym', label: 'Home gym (dumbbells, pull-up bar, bench)' },
        { value: 'minimal', label: 'Minimal (resistance bands, bodyweight)' },
        { value: 'none', label: 'No equipment (bodyweight only)' },
      ],
      impactsPersonalization: 'Determines exercise selection',
      required: true,
    },
    {
      id: 'strength_experience',
      question: 'How would you describe your strength training experience?',
      type: 'single_choice',
      options: [
        { value: 'none', label: 'Never done strength training' },
        { value: 'beginner', label: 'Beginner - Less than 6 months' },
        { value: 'intermediate', label: 'Intermediate - 6 months to 2 years' },
        { value: 'advanced', label: 'Advanced - 2+ years consistent training' },
      ],
      impactsPersonalization: 'Sets volume, intensity, and exercise complexity',
      required: true,
    },
    {
      id: 'frame_goal',
      question: 'What\'s your primary frame goal?',
      type: 'single_choice',
      options: [
        { value: 'strength', label: 'Build strength' },
        { value: 'muscle', label: 'Build muscle (hypertrophy)' },
        { value: 'fat_loss', label: 'Lose body fat while maintaining muscle' },
        { value: 'general', label: 'General fitness and functional strength' },
      ],
      impactsPersonalization: 'Adjusts rep ranges and nutrition guidance',
      required: true,
    },
    {
      id: 'time_per_session',
      question: 'How much time per strength session?',
      type: 'single_choice',
      options: [
        { value: '20', label: '20-30 minutes' },
        { value: '30', label: '30-45 minutes' },
        { value: '45', label: '45-60 minutes' },
        { value: '60', label: '60+ minutes' },
      ],
      impactsPersonalization: 'Determines session structure and exercise count',
      required: true,
    },
    {
      id: 'joint_issues',
      question: 'Any joint issues or injuries to work around?',
      type: 'text',
      impactsPersonalization: 'Modifies exercise selection and range of motion',
      required: false,
    },
    {
      id: 'training_split',
      question: 'Preferred training split?',
      type: 'single_choice',
      options: [
        { value: 'full_body', label: 'Full body (train everything each session)' },
        { value: 'upper_lower', label: 'Upper/Lower split' },
        { value: 'push_pull_legs', label: 'Push/Pull/Legs split' },
        { value: 'no_preference', label: 'No preference - decide for me' },
      ],
      impactsPersonalization: 'Determines program structure',
      required: true,
    },
  ],
  
  optionalModules: [],
  
  safety: {
    contraindications: [
      'Acute injury without clearance',
      'Uncontrolled hypertension during exertion',
      'Recent surgery (within recovery period)',
    ],
    beginnerIntensityCap: 'RPE 6-7 maximum for first 4 weeks, focus on form',
    warningSignals: [
      'Sharp pain during any movement',
      'Joint swelling or instability',
      'Numbness or tingling',
      'Pain that persists after exercise',
    ],
    seekProfessionalIf: [
      'Any acute injury occurs',
      'Persistent joint pain beyond normal soreness',
      'History of herniated disc with radiating pain',
      'Unsure about proper form for compound lifts',
    ],
  },
}

