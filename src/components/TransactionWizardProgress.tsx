type TransactionWizardProgressProps = {
  currentStep: number
  totalSteps: number
}

export function TransactionWizardProgress({
  currentStep,
  totalSteps,
}: TransactionWizardProgressProps) {
  return (
    <div className="wizard-progress" aria-label={`${currentStep} / ${totalSteps}`}>
      {Array.from({ length: totalSteps }, (_, index) => {
        const step = index + 1

        return (
          <span
            key={step}
            className={[
              'wizard-progress-dot',
              step === currentStep ? 'active' : '',
              step < currentStep ? 'complete' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        )
      })}
      <span className="wizard-progress-count">{currentStep} / {totalSteps}</span>
    </div>
  )
}
