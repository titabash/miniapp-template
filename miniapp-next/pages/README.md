# Pages Directory

This directory exists to prevent Next.js from trying to use the `src/pages/` directory for the Pages Router.

**This project uses App Router only** - all pages are located in the `app/` directory.

The `src/pages/` directory contains page components that are imported by App Router pages, not Pages Router pages.

Do not place any Pages Router files in this directory.