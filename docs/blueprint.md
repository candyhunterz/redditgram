# **App Name**: Sub Gallery

## Core Features:

- Subreddit Input: Input field to enter multiple subreddit names, separated by commas.
- Data Fetching: Fetch 'hot' posts from Reddit API for each subreddit.
- Media Filtering: Filter fetched posts to include only images and videos.
- Grid Display: Display media in an Instagram-like grid layout with thumbnails.
- Expanded View: Modal view to display the full image or play the video when a thumbnail is clicked.

## Style Guidelines:

- Primary color: White or light grey for a clean background.
- Accent color: Teal (#008080) to highlight interactive elements.
- Use CSS Grid for the main gallery layout to ensure responsiveness.
- Simple, modern icons for actions like closing the modal.
- Subtle fade-in animations when loading new images or opening modals.

## Original User Request:
You are tasked with building a full-stack web application that aggregates and displays images and videos from user-specified subreddits in an Instagram-like layout. The application should be modern, responsive, and user-friendly. Below are the detailed requirements and guidelines for this project.

Functional Requirements
User Input:

Create an input form where the user can enter one or multiple subreddit names (e.g., /r/pics, /r/cats).
Validate the input to ensure that each subreddit name is in the correct format.
Data Fetching & Processing:

For each provided subreddit, fetch the "hot" posts using Reddit's public JSON API endpoint (e.g., https://www.reddit.com/r/{subreddit}/hot.json).
Limit the number of posts fetched per subreddit (for example, the top 20 posts) to ensure performance.
Filter the fetched posts to include only those that contain images or videos. Exclude posts that are text-only or lack media content.
Consolidate the media content from all subreddits into a single list or feed.
Backend API:

Develop a backend service (using Node.js with Express, Python with Django/Flask, or another preferred technology) that:
Accepts subreddit inputs from the frontend.
Handles fetching and processing data from Reddit.
Returns a structured JSON response containing the filtered media posts.
Implement error handling to manage invalid subreddit names, API errors, and any other potential issues.
Optionally, consider implementing caching or rate-limiting mechanisms to optimize performance and handle high request volumes.
Frontend:

Build a responsive UI that mimics Instagram’s layout, using a grid to display thumbnails of images and videos.
Ensure that the UI is mobile-friendly and adapts well to different screen sizes.
Implement features such as:
Thumbnail view: Display each media post as a thumbnail in a grid layout.
Expanded view: Allow users to click on a thumbnail to view the full image or video in a modal or dedicated view.
Lazy loading or pagination to improve performance when many posts are loaded.
Use a modern front-end framework/library (e.g., React, Angular, Vue) or vanilla JavaScript with modern CSS (e.g., CSS Grid or Flexbox) to build the UI.
General:

Write clean, modular, and well-commented code for both the frontend and backend.
Provide documentation (such as a README file) with clear instructions on how to set up, run, and deploy the application.
Optionally, include deployment scripts or Docker configuration for containerization.
Technical Stack Suggestions
Backend: Node.js with Express, Python with Django/Flask, or your preferred server-side technology.
Frontend: React, Angular, Vue, or a modern JavaScript framework; alternatively, plain HTML/CSS/JavaScript with modern libraries.
Data Source: Reddit JSON API for fetching hot posts from specified subreddits.
Styling: Use CSS Grid or Flexbox (or a CSS framework) to create an Instagram-like grid layout.
Deliverables
Source Code: Complete source code for both the backend and frontend.
Documentation: In-code comments and a README file detailing:
Project overview
Setup and installation instructions
Running and testing the application
Any dependencies and configuration steps
Error Handling: Ensure robust error handling for network errors, invalid input, and API response issues.
Goal
The final application should enable users to input subreddit names, automatically fetch and filter the latest image and video posts from those subreddits, and display them in an engaging, Instagram-like gallery. The app must be fully functional, responsive, and easy to use.
  