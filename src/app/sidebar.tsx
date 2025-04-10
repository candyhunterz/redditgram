"use client";

import React, { useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const SidebarComponent = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sidebar>
      <SidebarHeader>
        <h4 className="font-semibold text-md">Sub Gallery</h4>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              Home
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton>
              Explore
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Customize your experience.
            </DialogDescription>
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between rounded-md p-2">
                <label
                  htmlFor="autoplay"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Autoplay Videos
                </label>
                <Switch id="autoplay" />
              </div>
              <div className="flex items-center justify-between rounded-md p-2">
                <label
                  htmlFor="darkmode"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Dark Mode
                </label>
                <Switch id="darkmode" />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </SidebarFooter>
    </Sidebar>
  );
};

export default SidebarComponent;
