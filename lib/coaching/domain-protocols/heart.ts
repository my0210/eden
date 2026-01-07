/**
 * Heart Domain Protocol Template
 * 
 * Focus: Zone 2 cardio progression, VO2max improvement
 * Evidence-based approach for cardiovascular health
 */

import { DomainTemplate } from './types'

export const heartTemplate: DomainTemplate = {
  id: 'heart',
  version: 1,
  name: 'Heart',
  preview: 'Zone 2 cardio progression for VO2max',
  
  focusAreas: [
    'Zone 2 cardiovascular training',
    'VO2max improvement',
    'Resting heart rate optimization',
    'Heart rate recovery',
  ],
  
  phases: [
    {
      number: 1,
      name: 'Foundation',
      durationWeeks: 4,
      focus: 'Build aerobic base with consistent Zone 2 work',
      successCriteria: 'Complete 3+ Zone 2 sessions per week for 4 weeks',
    },
    {
      number: 2,
      name: 'Build',
      durationWeeks: 4,
      focus: 'Increase duration and add variety',
      successCriteria: 'Maintain Zone 2 volume, add 1 tempo session per week',
    },
    {
      number: 3,
      name: 'Peak',
      durationWeeks: 4,
      focus: 'Add high-intensity intervals for VO2max stimulus',
      successCriteria: 'Complete 1-2 HIIT sessions per week while maintaining base',
    },
  ],
  
  actionTemplates: [
    {
      id: 'zone2_cardio',
      title: 'Zone 2 Cardio',
      description: 'Low-intensity cardio keeping heart rate in Zone 2 (60-70% max HR). You should be able to hold a conversation. Choose your preferred activity: walking, cycling, swimming, or elliptical.',
      type: 'action',
      defaultSchedule: {
        frequency: '3x',
        targetCount: 3,
        suggestedDays: ['Monday', 'Wednesday', 'Friday'],
        preferredTime: 'morning',
      },
      targetMetric: 'vo2max',
      successCriteria: 'Maintain Zone 2 HR for full duration',
      fallback: 'If time-crunched, do a 15-min Zone 2 walk instead',
      phases: [1, 2, 3],
      personalizationHints: [
        'Duration based on current fitness level (20-60 min)',
        'Activity based on user preference and access',
        'HR zone targets based on age',
      ],
    },
    {
      id: 'morning_walk',
      title: 'Morning Walk',
      description: 'Start your day with a 10-15 minute walk. Light effort, no specific HR target. Great for recovery and circadian rhythm.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'morning',
      },
      fallback: 'Walk around your home/office for 5 minutes',
      phases: [1, 2, 3],
    },
    {
      id: 'track_rhr',
      title: 'Track Resting Heart Rate',
      description: 'Check your resting heart rate first thing in the morning before getting out of bed. Note any trends.',
      type: 'habit',
      defaultSchedule: {
        frequency: 'daily',
        targetCount: 7,
        preferredTime: 'morning',
      },
      targetMetric: 'resting_hr',
      phases: [1, 2, 3],
      prerequisites: ['Heart rate monitor or smartwatch'],
    },
    {
      id: 'tempo_run',
      title: 'Tempo Session',
      description: 'Sustained effort at "comfortably hard" pace (Zone 3-4). Builds lactate threshold.',
      type: 'action',
      defaultSchedule: {
        frequency: 'weekly',
        targetCount: 1,
        suggestedDays: ['Saturday'],
        preferredTime: 'morning',
      },
      targetMetric: 'vo2max',
      successCriteria: 'Maintain tempo pace for target duration',
      fallback: 'Do a hilly Zone 2 walk instead',
      phases: [2, 3],
      personalizationHints: [
        'Duration 15-30 min based on fitness',
        'Can be running, cycling, or rowing',
      ],
    },
    {
      id: 'hiit_session',
      title: 'HIIT Session',
      description: 'High-intensity intervals: 4-6 rounds of 30-60 seconds hard effort with equal rest. Maximum VO2max stimulus.',
      type: 'action',
      defaultSchedule: {
        frequency: 'weekly',
        targetCount: 1,
        suggestedDays: ['Tuesday'],
        preferredTime: 'morning',
      },
      targetMetric: 'vo2max',
      successCriteria: 'Complete all intervals at target intensity',
      fallback: 'Do tempo session instead if recovery is low',
      phases: [3],
      personalizationHints: [
        'Interval length based on fitness level',
        'Activity based on user preference',
        'Skip if HRV indicates poor recovery',
      ],
    },
  ],
  
  setupQuestions: [
    {
      id: 'hr_monitor',
      question: 'Do you have a heart rate monitor or smartwatch with HR tracking?',
      type: 'boolean',
      impactsPersonalization: 'Determines if we can give precise HR zone targets',
      required: true,
    },
    {
      id: 'cardio_preference',
      question: 'What type of cardio do you prefer or have access to?',
      type: 'multi_choice',
      options: [
        { value: 'walking', label: 'Walking/Hiking' },
        { value: 'running', label: 'Running/Jogging' },
        { value: 'cycling', label: 'Cycling (outdoor or indoor)' },
        { value: 'swimming', label: 'Swimming' },
        { value: 'rowing', label: 'Rowing' },
        { value: 'elliptical', label: 'Elliptical/Cross-trainer' },
      ],
      impactsPersonalization: 'Determines which activities to prescribe',
      required: true,
    },
    {
      id: 'cardio_experience',
      question: 'How would you describe your current cardio fitness?',
      type: 'single_choice',
      options: [
        { value: 'sedentary', label: 'Sedentary - Little to no regular cardio' },
        { value: 'occasional', label: 'Occasional - 1-2 sessions per week' },
        { value: 'regular', label: 'Regular - 3+ sessions per week' },
        { value: 'trained', label: 'Trained - Consistent training for 6+ months' },
      ],
      impactsPersonalization: 'Sets starting duration and intensity',
      required: true,
    },
    {
      id: 'time_available',
      question: 'How much time can you dedicate to cardio per session?',
      type: 'single_choice',
      options: [
        { value: '15', label: '15-20 minutes' },
        { value: '30', label: '30-40 minutes' },
        { value: '45', label: '45-60 minutes' },
        { value: '60', label: '60+ minutes' },
      ],
      impactsPersonalization: 'Sets session duration targets',
      required: true,
    },
    {
      id: 'cardio_injuries',
      question: 'Any injuries or conditions that affect your cardio (knee issues, asthma, etc.)?',
      type: 'text',
      impactsPersonalization: 'Adjusts activity selection and intensity',
      required: false,
    },
    {
      id: 'indoor_outdoor',
      question: 'Do you prefer indoor or outdoor cardio?',
      type: 'single_choice',
      options: [
        { value: 'outdoor', label: 'Outdoor - I prefer being outside' },
        { value: 'indoor', label: 'Indoor - Gym or home equipment' },
        { value: 'both', label: 'Both - Flexible based on weather/mood' },
      ],
      impactsPersonalization: 'Determines activity recommendations',
      required: true,
    },
  ],
  
  optionalModules: [],
  
  safety: {
    contraindications: [
      'Uncontrolled hypertension (>180/110)',
      'Recent cardiac event (within 6 months)',
      'Unstable angina',
      'Severe aortic stenosis',
    ],
    beginnerIntensityCap: 'Zone 2 only for first 4 weeks',
    warningSignals: [
      'Chest pain or pressure during exercise',
      'Unusual shortness of breath',
      'Dizziness or lightheadedness',
      'Heart palpitations or irregular heartbeat',
    ],
    seekProfessionalIf: [
      'Any chest discomfort during exercise',
      'Family history of sudden cardiac death',
      'Known heart condition without clearance',
      'Resting HR consistently above 100 bpm',
    ],
  },
}

