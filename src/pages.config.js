/**
 * pages.config.js - Page routing configuration
 */
import Landing from './pages/Landing';
import Home from './pages/Home';
import HouseDetails from './pages/HouseDetails';
import UserManagement from './pages/UserManagment';
import ExcursionCalculator from './pages/ExcursionCalculator';

export const PAGES = {
    "Landing": Landing,
    "Home": Home,
    "HouseDetails": HouseDetails,
    "UserManagement": UserManagement,
    "ExcursionCalculator": ExcursionCalculator,
};

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
};
