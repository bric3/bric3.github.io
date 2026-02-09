---
authors: ["brice.dutheil"]
date: "2018-06-18T00:00:00Z"
language: en
tags:
- kubernetes
- minikube
- docker
- mac
- osx
- hyperkit
slug: minikube-with-hyperkit
title: Minikube with hyperkit
---

While Docker for mac in the edge channel offers a Kubernetes integration,
I wanted to have the same tool as my pals on linux, who're most likely 
using [minikube](https://github.com/kubernetes/minikube).

Minikube on OSX requires a virtual machine which is by default 
VirtualBox, since minikube is using the docker a the container runtime it bootstrap the VM environment with `boot2docker`. 

I wanted an approach that felt a bit more _modern_. Early docker **on** mac required a virtual machine, then people ported [bhyve](http://www.bhyve.org/) (BSD hypervisor) 
to OSX, under the name [xhyve](https://github.com/mist64/xhyve) using OSX 
[Hypervisor.framework](https://developer.apple.com/library/mac/documentation/DriversKernelHardware/Reference/Hypervisor/index.html). 
That one allowed to _light virtual machines_ and gave birth the 
[docker-machine-xhyve-driver](https://github.com/zchee/docker-machine-driver-xhyve).

In case minikube is not installed, let's do it :

```sh
brew cask install minikube
```

So let's start to install Minikube with _xhyve_.

```sh
➜ brew update
➜ brew install xhyve
➜ brew install docker-machine-driver-xhyve

# apply docker-machine-driver-xhyve caveats
➜ sudo chown root:wheel $(brew --prefix)/opt/docker-machine-driver-xhyve/bin/docker-machine-driver-xhyve
➜ sudo chmod u+s $(brew --prefix)/opt/docker-machine-driver-xhyve/bin/docker-machine-driver-xhyve
```

And then start minikube 

```sh
➜ minikube start --vm-driver=xhyve
Starting local Kubernetes v1.10.0 cluster...
Starting VM...
WARNING: The xhyve driver is now deprecated and support for it will be removed in a future release.
Please consider switching to the hyperkit driver, which is intended to replace the xhyve driver.
See https://github.com/kubernetes/minikube/blob/master/docs/drivers.md#hyperkit-driver for more information.
To disable this message, run [minikube config set WantShowDriverDeprecationNotification false]
```

Indeed later _Docker-**for**-mac_ team decided to also use the OSX 
[Hypervisor.framework](https://developer.apple.com/library/mac/documentation/DriversKernelHardware/Reference/Hypervisor/index.html)
that can make sense that minikube does too. Let's switch to hyperkit. 
First remove previous work since there's nothing in it yet.

```sh
➜ rm -rf $HOME/.minikube
```

Being lazy I'd like to see if homebrew has a formula for the driver, 
unfortunately not yet, but soon!

```sh
➜ brew search hyperkit
==> Searching local taps...
==> Searching taps on GitHub...
==> Searching blacklisted, migrated and deleted formulae...
No formula found for "hyperkit".
Open pull requests:
hyperkit 0.20180123 (new formula) (https://github.com/Homebrew/homebrew-core/pull/25593)
docker-machine-driver-hyperkit 0.27.0 (new formula) (https://github.com/Homebrew/homebrew-core/pull/28076)
```

So let's follow the [instructions](https://github.com/kubernetes/minikube/blob/master/docs/drivers.md#hyperkit-driver) given in the above output.

```sh
➜ curl -LO https://storage.googleapis.com/minikube/releases/latest/docker-machine-driver-hyperkit \
&& chmod +x docker-machine-driver-hyperkit \
&& sudo mv docker-machine-driver-hyperkit /usr/local/bin/ \
&& sudo chown root:wheel /usr/local/bin/docker-machine-driver-hyperkit \
&& sudo chmod u+s /usr/local/bin/docker-machine-driver-hyperkit
```

Then lets's start with _hyperkit_ driver, as I'm curious I'd like to 
understand what minikube is doing using I'd like to log it in the terminal using `--logtostderr` flag, `--v=3` allows to see machine lib logs.

```sh
➜ minikube start --logtostderr --v=3 --vm-driver=hyperkit
Starting local Kubernetes v1.10.0 cluster...
Starting VM...
Downloading Minikube ISO
 150.53 MB / 150.53 MB [============================================] 100.00% 0s
Creating CA: /Users/b.dutheil/.minikube/certs/ca.pem
Creating client certificate: /Users/b.dutheil/.minikube/certs/cert.pem
Running pre-create checks...
Creating machine...
(minikube) Downloading /Users/b.dutheil/.minikube/cache/boot2docker.iso from file:///Users/b.dutheil/.minikube/cache/iso/minikube-v0.26.0.iso...
(minikube) Using UUID ff84da9e-6f17-11e8-bb91-acbc329d1659
(minikube) Generated MAC aa:27:57:cf:3e:a
(minikube) Starting with cmdline: loglevel=3 user=docker console=ttyS0 console=tty0 noembed nomodeset norestore waitusb=10 systemd.legacy_systemd_cgroup_controller=yes base host=minikube
Waiting for machine to be running, this may take a few minutes...
Detecting operating system of created instance...
Waiting for SSH to be available...
Detecting the provisioner...
Provisioning with buildroot...
...
Setting Docker configuration on the remote daemon...
Checking connection to Docker...
Docker is up and running!
Getting VM IP address...
Moving files into cluster...
...
Downloading kubeadm v1.10.0
Downloading kubelet v1.10.0
Finished Downloading kubelet v1.10.0
Finished Downloading kubeadm v1.10.0
...
sudo systemctl daemon-reload &&
sudo systemctl enable kubelet &&
sudo systemctl start kubelet

Setting up certs...
...
Connecting to cluster...
Setting up kubeconfig...
I0613 16:43:56.893673   37114 config.go:101] Using kubeconfig:  /Users/b.dutheil/.kube/config
Starting cluster components...
...
Kubectl is now configured to use the cluster.
Loading cached images from config file.
```

More output than I expected, but it revealed interesting details. However
For the sake of readability I removed some log lines.

The first thing to notice is it shows which version of Kubernetes is used :
`Kubernetes v1.10.0 cluster`, then another interesting thing it uses a minikube ISO with a different version `0.26.0` than the installed version (`minikube version`) is `0.27.0`.

Then the log shows every step that are needed to set up the kube cluster,
configuring SSH, installing kubelet, kubeadm, especially.

Since I wondered about versions, what is the docker version ?

```sh
➜ minikube ssh
$ docker version
Client:
 Version:	17.12.1-ce
 API version:	1.35
 Go version:	go1.9.4
 Git commit:	7390fc6
 Built:	Tue Feb 27 22:13:43 2018
 OS/Arch:	linux/amd64

Server:
 Engine:
  Version:	17.12.1-ce
  API version:	1.35 (minimum version 1.12)
  Go version:	go1.9.4
  Git commit:	7390fc6
  Built:	Tue Feb 27 22:20:43 2018
  OS/Arch:	linux/amd64
  Experimental:	false
```

So not the latest _edgy_ docker version. Not a problem for most people
especially since this one supports multi-stage build. And that quite 
likely nobody will build a docker image in minikube. So let's keep that 
concern aside for now


Now that our kube cluster is ready let's interact with it. Make sure 
kube cli is using our minikube context :

```sh
➜ kubectl config get-contexts
CURRENT   NAME                                                 CLUSTER                                              AUTHINFO                                             NAMESPACE
          gke_infra-sandbox-XXXXXXXX_europe-west1-c_cluster1   gke_infra-sandbox-XXXXXXXX_europe-west1-c_cluster1   gke_infra-sandbox-XXXXXXXX_europe-west1-c_cluster1
*         minikube                                             minikube                                             minikube
```

Check. It is possible to interact with the minikube cluster using `kubectl`.

Using the commands from their github repo :

```sh
# deploy a simple image
➜ kubectl run hello-minikube --image=k8s.gcr.io/echoserver:1.4 --port=8080
deployment.apps "hello-minikube" created

# expose the service outside the cluster
➜ kubectl expose deployment hello-minikube --type=NodePort
service "hello-minikube" exposed

➜ minikube service hello-minikube --url
```

Also minikube comes with a dashboard : 

```sh
➜ minikube dashboard
Opening kubernetes dashboard in default browser...
```

![minikube-kubernetes-dashboard](/assets/minikube-discovery/minikube-kube-dashboard.png)


And finally don't forget to stop the cluster

```sh
minikube stop
```


Upon re-starting the cluster, minikube won't have to recreate the cluster,
just bootstrap it, so just run `minikube start`


Finally play with `kubectl` to deploy, scale, etc.