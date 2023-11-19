# OpenAI Assistant on Discord

This repository contains an application that allows you to add OpenAI Assistants to your Discord server. The application uses Appwrite as the database for tracking the threads and assistants.

> **DISCLAIMER:** This personal project is in early development and this README is still under construction. It is required that you have some knowledge on the technologies used or are interested in researching by yourself since you will have to do some things manually to make this work.

## Structure

The project is structured as a monorepo using [Nx](https://nx.dev/), which helps with sharing code between the backend and frontend, and improves the development experience with integrated testing and building.

## Features

- Add OpenAI Assistants to your Discord server.
- Conversations are done in Discord threads. Only one OpenAI assistant can be added in the thread.

## Tech Stack

- [Node.js](https://nodejs.org/en/)
- [Nx](https://nx.dev/) for monorepo management.
- [Appwrite](https://appwrite.io/) for database management.
- [OpenAI](https://openai.com/) for AI Assistants.
- [Discord.js](https://discordjs.org) for the Discord bots.

## Prerequisites

- You need to separately setup Appwrite and put the credentials in the `.env` file.
- You must have an OpenAI account and must provide your own API Key in the `.env` file.
- One OpenAI Assistant is also one Discord bot.
- You must create a Supervisor bot which you will use for managing the AI bots. (At the moment, the only function is to refresh/restart the bots.)

## Setup

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Import the Appwrite schema `appwrite.json` to your Appwrite instance using `appwrite` command. See [Appwrite CLI](https://appwrite.io/docs/tooling/command-line/installation) for more information.
4. Go to Appwrite server and in the `SystemConfg` collection, create a document with the following data:
    ```json
    {
      "config_name": "supervisor_discord_token",
      "config_value": "<insert discord token here>"
    }
    ```
5. Go to your Appwrite server and add the details of your bots to the `Assistants` collection.
6. Run the app `npm serve sidekicks`.

## Usage

After setting up the application, you can now go to your Discord server and start interacting with the OpenAI Assistants.

To start a conversation, just mention the OpenAI assistant in any channel the bots have access to.

If you later add a new bot, do `@Supervisor restart`.

## Build and deploy

There is an existing Dockerfile that you can use to containerize the app.

Run `nx docker-build sidekicks` to build the container. Default tag is `sidekicks`. 

See `apps/sidekicks/project.json` file and look for `docker-*` targets for more information.

Sample `docker-compose.yml`:

```yaml
version: "3.8"
services:
  sidekicks:
    image: sidekicks
    restart: unless-stopped
    environment:
      - OPENAI_API_KEY=
      - APPWRITE_ENDPOINT=http://localhost:8080/v1
      - APPWRITE_PROJECT=
      - APPWRITE_API_KEY=
      - TZ=Asia/Manila
```

## Screenshots

![image](https://github.com/rmarfil3/openai-discord/assets/12169248/28d998a5-a61d-4e86-bb31-2a203d46bfc3)

