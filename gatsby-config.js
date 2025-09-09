/**
 * Gatsby Configuration
 *
 * Docs: https://www.gatsbyjs.com/docs/reference/config-files/gatsby-config/
 */

const activeEnv =
  process.env.GATSBY_ACTIVE_ENV || process.env.NODE_ENV || "development";

require("dotenv").config({
  path: `.env.${activeEnv}`,
});

// 💡 Safe console logs (do not print secrets)
console.log("💡 Active Environment:", activeEnv);
console.log("💡 GATSBY_API_BASE:", process.env.GATSBY_API_BASE || "(not set)");
console.log(
  "💡 GATSBY_MAPBOX_ACCESS_TOKEN:",
  process.env.GATSBY_MAPBOX_ACCESS_TOKEN ? "(loaded)" : "(missing)"
);

module.exports = {
  siteMetadata: {
    title: `Fun Runs`,
    description: `Map visualization of Strava activities.`,
    author: `@aojin`,
    siteUrl: `https://fun-runs.vercel.app/`,
  },
  plugins: [
    `gatsby-plugin-image`,
    `gatsby-plugin-sharp`,
    `gatsby-transformer-sharp`,
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `images`,
        path: `${__dirname}/src/images`,
      },
    },
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `Fun Runs`,
        short_name: `funruns`,
        start_url: `/`,
        background_color: `#000000`,
        theme_color: `#663399`,
        display: `minimal-ui`,
        icon: `src/images/gatsby-icon.png`,
      },
    },
    // 🚫 Removed gatsby-plugin-env-variables (not needed for GATSBY_ vars)
  ],
};
