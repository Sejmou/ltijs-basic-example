# Super basic LTI tool example with [ltijs](https://www.npmjs.com/package/ltijs)

[LTI](https://www.imsglobal.org/basic-overview-how-lti-works) stands for "Learning Tools Interoperability" and is a standard for integrating Learning Management Systems (LMS) – including [Moodle](https://moodle.org/) – with learning applications.
The basic idea is that any LMS and any learning application that support the same version of LTI will 'just work' together seamlessly.

IIUC, this example works with LTI 1.3, which as of September 2026 is the recommended version of LTI ([source](https://www.1edtech.org/lti-security-announcement-and-deprecation-schedule)).

> **NOTE:** LTI is NOT developed by the Moodle team, but rather it's a standard developed by [1EdTech](https://www.1edtech.org/) (formerly known as IMS Global), a non-profit that unfortunately [has some issues](https://www.reddit.com/r/edtech/comments/1vc461u/opinions_on_1edtech/), esp. wrt. to openness and transparency.
> 
> Most importantly, vital documentation and source code as well as conformance certification are locked down behind membership fees that aren't disclosed publicly.

[ltijs](https://www.npmjs.com/package/ltijs) seems to be a fairly popular option for making LTI work for NodeJS applications.
It promises to make configuration super simple, while also abstracting a lot of things away (maybe even too much, but that's your decision, obviously).

This repo should serve as a quick starting point for reproducing the [minimal tool example](https://cvmcosta.me/ltijs/#/guides/getting-started?id=a-minimal-tool) from the documentation.

It has two components:

1. A NodeJS server serving the frontend and backend of a (very) minimal LTI tool using `ltijs` (which under the hood launches an [`express.js`](https://expressjs.com/) application)
2. (Annoyingly) a MongoDB database (MongoDB is the default `ltijs` expects; it can be swapped for another one, but you'll have to implement your own `DatabaseManager`)

## Installation (on your deployment server)

Everything is containerized through a `compose.yaml`. You should be able to launch things with a simple `podman compose up -d` (you should also be able to use `docker`).

You should make the tool available under a URL that your LMS can access (for prod, of course please use HTTPS!).

## Configuration inside LMS (Moodle)

> **NOTE:** This has only been tested on a Moodle instance; in other LMSes the configuration forms etc. might work differently.
>
> Of course, you can always refer to the official specification as the 'source of truth', but some further tinkering might always be necessary.

1. Navigate to the 'LTI External tools' page for your course under `https://<your-moodle-instance>/mod/lti/coursetools.php?id=<your-course-id>`
2. Click 'Add tool' - **NOTE:** if that button is not available to you, LTI external tools probably have been disabled and you'll have to reach out to the administrators of your Moodle instance for assistance. Whether you'll be allowed to add your own entirely depends on the policies of your institution. It _is_ however possible to give certain users permission to add tools just to their team's courses.
3. A form somewhat like this should open up; fill it with the values shown, replacing the blanked out base URL portion with the URL under which you deployed the tool (it might be necessary to save the config once to get a client ID)
<img width="1199" height="668" alt="CleanShot 2026-09-16 at 23 01 39" src="https://github.com/user-attachments/assets/fc4bccfe-da4c-4c41-a8cb-01647f3cd7a1" />
  
  > **Pro-tip:** adding `_` to your tool name makes sure it'll show up at the beginning of the tool list 😉
4. Pray things work

