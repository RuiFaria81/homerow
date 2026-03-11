# 🏠 homerow - Control Your Email, Your Way

[![Download](https://img.shields.io/badge/Download-From_GitHub-brightgreen)](https://github.com/RuiFaria81/homerow)

## 📧 What is homerow?

homerow helps you run your own email service. It gives you full control over your mail system. You get a fresh, modern mail app to manage your emails. It uses NixOS to set up everything for you. You do not need to depend on outside providers.

You can send and receive emails safely on your own system. It includes tools to build your mail server and a clean webmail interface for daily use.

## 🖥️ System Requirements

Before you start, make sure your Windows PC meets these needs:

- Windows 10 or newer  
- At least 8 GB of RAM for smooth operation  
- 20 GB free disk space for mail storage  
- Stable internet connection  
- Administrative rights to install software  

You will also need Docker for Windows, which homerow uses to run the mail server in containers. Docker runs well on most Windows PCs but needs virtualization enabled in BIOS.

## 🚀 Getting Started

Follow each step carefully to set up homerow on your Windows machine.

### 1. Download homerow

Go to the GitHub repository to get all the files needed:

[![Download](https://img.shields.io/badge/Get_homerow-From_GitHub-blue)](https://github.com/RuiFaria81/homerow)

Click the green **Code** button at the top right. Select **Download ZIP** to save all files on your computer.

Save the ZIP file somewhere easy to find, like the Desktop or Downloads folder.

### 2. Install Docker Desktop

homerow runs its services inside Docker containers. Docker lets you run apps packaged with everything they need.

Download Docker Desktop for Windows here: https://www.docker.com/products/docker-desktop

Run the installer and follow instructions. After installation, restart your PC if it asks.

Once Docker is running, click the Docker icon in your system tray to check status. It should say “Docker is running”.

### 3. Extract homerow files

Find the ZIP you downloaded and right-click it. Choose **Extract All**, then pick a folder like the Desktop.

Open the extracted folder. Inside you will see configuration files and scripts.

### 4. Open PowerShell

You need to run commands in PowerShell to start homerow.

- Press **Windows + S** and search for **PowerShell**.  
- Right-click **Windows PowerShell**, then choose **Run as administrator**.

Running as administrator is important for Docker commands to work properly.

### 5. Start homerow services

In PowerShell, use the command to go to the folder where you extracted homerow. For example:

```powershell
cd C:\Users\YourName\Desktop\homerow
```

Replace `YourName` with your computer user name or the folder path you chose.

Once inside the folder, run this command:

```powershell
docker-compose up -d
```

This command tells Docker to run the mail server and webmail interface in the background.

### 6. Access your new webmail

After a few moments, your mail interface will be ready.

Open your web browser and go to:

```
http://localhost:8080
```

You will see the homerow webmail login or setup page.

### 7. Configure your email account

Use the interface to create and manage your email inboxes. You can send and receive messages right away.

The system handles all backend setup, including mail delivery and spam control.

---

## ⚙️ How homerow Works

homerow uses a set of open-source tools bundled together:

- **NixOS**: Controls how software is installed and configured. It ensures the system is consistent.  
- **Docker**: Runs each part of homerow inside containers. These are like mini virtual machines.  
- **Terraform**: Manages infrastructure code for deploying the mail system.  
- **Typescript**: Powers the webmail interface software.  

This setup means you do not need to manually install or patch complex mail server software.

You get the benefits of a modern mail system combined with full control and privacy.

---

## 🔧 Management Tips

- To stop homerow, open PowerShell in the homerow folder and run:

  ```powershell
  docker-compose down
  ```

- To see logs and troubleshoot issues:

  ```powershell
  docker-compose logs -f
  ```

- If you want to update homerow, download the latest files from GitHub and replace your current folder contents.

- Make sure Docker Desktop stays up to date for best performance and security.

---

## 📚 Additional Resources

- Visit the GitHub repository’s [Issues](https://github.com/RuiFaria81/homerow/issues) page for common questions or to ask for help.  
- Check Docker’s official docs at https://docs.docker.com for details on running containers.  
- Learn about NixOS and Terraform for advanced customization and automation.  

---

## 💾 Download Links

You can always get the latest version of homerow from GitHub here:

[![Download](https://img.shields.io/badge/Download-latest_release-grey)](https://github.com/RuiFaria81/homerow)

---

## ⚠️ Network and Security Tips

- Use a strong password for your mail accounts.  
- Do not run homerow on public or insecure networks without extra protection.  
- Consider setting up a firewall to restrict unwanted access.  
- Make regular backups of your mail data folder to avoid data loss.

---

## 🗂️ Folder Structure Overview

Inside the extracted homerow folder, you will find:

- `docker-compose.yml`: Main file that tells Docker which services to run.  
- `nixos/`: Folder with system configuration scripts.  
- `webmail/`: Front-end files for the mail interface.  
- `README.md`: Documentation file explaining setup and usage.  

---

## 👩‍💻 Troubleshooting Common Issues

- Docker fails to start: Check if virtualization is enabled in your BIOS.  
- Port 8080 already in use: Close other apps that use the same port or change port number in `docker-compose.yml`.  
- Emails not sending: Verify your internet connection and server logs via `docker-compose logs`.  

---

## 🔄 Updating homerow

To update, download the latest ZIP from the link. Stop running containers first (`docker-compose down`). Replace old files with new ones. Then start again with `docker-compose up -d`.

Always backup your email data before upgrading.