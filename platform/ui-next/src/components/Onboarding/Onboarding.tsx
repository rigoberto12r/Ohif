import { useEffect } from 'react';
import { useShepherd } from 'react-shepherd';
import { StepOptions, TourOptions } from 'shepherd.js';
import { useLocation } from 'react-router';
import 'shepherd.js/dist/css/shepherd.css';
import './Onboarding.css';

import {
  hasTourBeenShown,
  markTourAsShown,
  defaultShowHandler,
  middleware,
  resetAllTours,
  getTourProgress,
} from './utilities';

export interface TourConfig {
  id: string;
  route: string;
  tourOptions: TourOptions;
  steps: StepOptions[];
  /** Only show for first-time users */
  firstTimeOnly?: boolean;
  /** Delay before showing tour in ms */
  delayMs?: number;
}

const Onboarding = ({
  tours = [],
  showWelcome = false,
  onTourComplete,
  onTourSkip,
}: {
  tours?: TourConfig[];
  /** Show a welcome screen for first-time users before starting tours */
  showWelcome?: boolean;
  /** Callback when a tour completes */
  onTourComplete?: (tourId: string) => void;
  /** Callback when a tour is skipped */
  onTourSkip?: (tourId: string) => void;
}) => {
  const Shepherd = useShepherd();
  const location = useLocation();

  /**
   * Show the tour if it hasn't been shown yet based on the current route.
   * Supports delayed start and completion tracking.
   */
  useEffect(() => {
    if (!tours.length) {
      return;
    }

    const matchingTour = tours.find(tour => tour.route === location.pathname);
    if (!matchingTour || hasTourBeenShown(matchingTour.id)) {
      return;
    }

    const startTour = () => {
      const tourInstance = new Shepherd.Tour({
        ...matchingTour.tourOptions,
        defaultStepOptions: {
          ...matchingTour.tourOptions?.defaultStepOptions,
          floatingUIOptions: matchingTour.tourOptions?.defaultStepOptions?.floatingUIOptions || {
            middleware,
          },
          when: {
            ...matchingTour.tourOptions?.defaultStepOptions?.when,
            show:
              matchingTour.tourOptions?.defaultStepOptions?.when?.show ||
              (() => defaultShowHandler(Shepherd)),
          },
        },
      });

      // Add "Skip All" button to the first step
      const stepsWithSkip = matchingTour.steps.map((step, index) => {
        if (index === 0) {
          return {
            ...step,
            buttons: [
              ...(step.buttons || []),
              {
                text: 'Skip All',
                action: () => {
                  tourInstance.cancel();
                  onTourSkip?.(matchingTour.id);
                },
                classes: 'shepherd-button-secondary',
              },
            ],
          };
        }
        return step;
      });

      stepsWithSkip.forEach(step => tourInstance.addStep(step));

      // Track completion
      tourInstance.on('complete', () => {
        markTourAsShown(matchingTour.id);
        onTourComplete?.(matchingTour.id);
      });

      tourInstance.on('cancel', () => {
        markTourAsShown(matchingTour.id);
      });

      tourInstance.start();
    };

    // Support delayed start
    const delay = matchingTour.delayMs || 0;
    const timer = setTimeout(startTour, delay);

    return () => clearTimeout(timer);
  }, [Shepherd, tours, location.pathname, onTourComplete, onTourSkip]);

  return null;
};

export { Onboarding };
