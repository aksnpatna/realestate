import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export default function OnboardingTour() {
  useEffect(() => {
    // Check if the user has already seen the tour
    const hasSeenTour = localStorage.getItem('realestate_tour_seen');
    if (hasSeenTour) return;

    const tour = driver({
      showProgress: true,
      animate: true,
      steps: [
        {
          element: '.sidebar',
          popover: {
            title: 'Welcome to Real Estate Engine',
            description: 'This is your command center. Use the sidebar to switch between different analysis modules like Suburb Profile, House Search, and Institutional Data.',
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '.search-input-row',
          popover: {
            title: 'Target Suburb',
            description: 'Search for any of the 13,000+ suburbs in Australia here. The platform will automatically load its institutional-grade metrics.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '.map-wrapper',
          popover: {
            title: 'Interactive Vector Heatmap',
            description: 'Explore the nation with our live PostGIS heatmap! Colored dots show the rental yield of every suburb. Zoom out for a macro view, or click a dot to see local data.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '.favorite-btn',
          popover: {
            title: 'Save Favorites',
            description: 'Found a lucrative market? Click the heart icon to save the suburb to your personal watch-list.',
            side: 'left',
            align: 'center'
          }
        }
      ],
      onDestroyStarted: () => {
        if (!tour.hasNextStep() || confirm("Are you sure you want to skip the tour?")) {
          localStorage.setItem('realestate_tour_seen', 'true');
          tour.destroy();
        }
      }
    });

    // Small delay to ensure DOM elements are fully mounted
    setTimeout(() => {
      tour.drive();
    }, 1000);

  }, []);

  return null;
}
