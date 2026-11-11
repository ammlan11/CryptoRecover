#!/usr/bin/env bash
# One-time hardening for a fresh Ubuntu 22.04/24.04 VPS (Contabo, Hostinger or any other).
# Run as root AFTER you can log in with an SSH key as a normal sudo user:
#   sudo bash deploy/harden-server.sh <your-sudo-username>
#
# What it does:
#  - firewall: only SSH (rate-limited), HTTP and HTTPS are reachable
#  - SSH: keys only, no root login, no passwords (refuses if your key isn't set up yet)
#  - fail2ban: bans addresses that keep failing SSH logins
#  - automatic security updates
#  - kernel network settings against spoofing and SYN floods
set -euo pipefail
USERNAME="${1:?usage: harden-server.sh <sudo-username>}"
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
KEYS="/home/$USERNAME/.ssh/authorized_keys"
if [ ! -s "$KEYS" ]; then
  echo "No SSH key found in $KEYS. Add your public key first, check you can log in with it,"
  echo "then run this again. (Stopping so you don't get locked out.)"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades > /dev/null

# Firewall. Docker publishes Caddy's 80/443 itself; nothing else is exposed
# (MySQL, ClamAV and the apps are on internal Docker networks only).
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp comment "SSH (rate-limited)"
ufw allow 80/tcp comment "HTTP (redirects to HTTPS)"
ufw allow 443/tcp comment "HTTPS"
ufw allow 443/udp comment "HTTP/3"
ufw --force enable

# SSH: keys only.
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/10-kurotrace.conf <<CONF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowUsers $USERNAME
CONF
sshd -t
systemctl reload ssh 2>/dev/null || systemctl reload sshd

# fail2ban for SSH.
cat > /etc/fail2ban/jail.d/kurotrace.local <<CONF
[sshd]
enabled = true
maxretry = 4
findtime = 10m
bantime = 1h
bantime.increment = true
CONF
systemctl enable --now fail2ban
systemctl restart fail2ban

# Automatic security updates (reboots at 04:00 if a kernel update needs it).
cat > /etc/apt/apt.conf.d/52kurotrace-upgrades <<CONF
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
CONF
systemctl enable --now unattended-upgrades

# Network hardening.
cat > /etc/sysctl.d/90-kurotrace.conf <<CONF
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
CONF
sysctl --system > /dev/null

echo
echo "Done. Before closing this session, open a NEW terminal and check you can still log in:"
echo "  ssh $USERNAME@<server-ip>"
ufw status verbose
