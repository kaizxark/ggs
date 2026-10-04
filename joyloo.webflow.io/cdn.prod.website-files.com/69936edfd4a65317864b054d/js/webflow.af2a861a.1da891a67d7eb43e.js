(() => {
    var e = {
            1430: function() {
                function e() {
                    let e = Webflow.require("ix3");
                    e.ready().then(() => {
                        let t = e.getInstance();
                        t && (t.register([{
                            id: "i-1a98f87a",
                            scope: {
                                type: "site"
                            },
                            triggers: [
                                ["wf:load", {
                                    controlType: "load"
                                }]
                            ],
                            timelineIds: ["t-81ba15d0"],
                            deleted: !1
                        }, {
                            id: "i-2d336c88",
                            scope: {
                                type: "site"
                            },
                            triggers: [
                                ["wf:load", {
                                    controlType: "load"
                                }]
                            ],
                            timelineIds: ["t-712f81e3"],
                            deleted: !1
                        }, {
                            id: "i-947b9cc9",
                            scope: {
                                type: "site"
                            },
                            triggers: [
                                ["wf:scroll", {
                                        controlType: "scroll",
                                        scrollTriggerConfig: {
                                            clamp: !0,
                                            start: "top bottom",
                                            end: "bottom top",
                                            scrub: null,
                                            enter: "play",
                                            leave: "none",
                                            enterBack: "none",
                                            leaveBack: "none"
                                        }
                                    },
                                    ["wf:class", ["care-in-action-widget"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ]
                            ],
                            timelineIds: ["t-377db625"],
                            deleted: !1
                        }, {
                            id: "i-d2a9a1b8",
                            scope: {
                                type: "site"
                            },
                            triggers: [
                                ["wf:scroll", {
                                        controlType: "scroll",
                                        scrollTriggerConfig: {
                                            clamp: !0,
                                            start: "top bottom",
                                            end: "bottom top",
                                            scrub: null,
                                            enter: "play",
                                            leave: "none",
                                            enterBack: "none",
                                            leaveBack: "none"
                                        }
                                    },
                                    ["wf:class", ["why-choose-us-card"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ]
                            ],
                            timelineIds: ["t-7b6ac40e"],
                            deleted: !1
                        }, {
                            id: "i-1a1ff03e",
                            scope: {
                                type: "site"
                            },
                            triggers: [
                                ["wf:scroll", {
                                        controlType: "scroll",
                                        scrollTriggerConfig: {
                                            clamp: !0,
                                            start: "top bottom",
                                            end: "bottom top",
                                            scrub: null,
                                            enter: "play",
                                            leave: "none",
                                            enterBack: "none",
                                            leaveBack: "none"
                                        }
                                    },
                                    ["wf:class", ["testimonial-card"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ]
                            ],
                            timelineIds: ["t-9aa91860"],
                            deleted: !1
                        }, {
                            id: "i-2b0185bc",
                            scope: {
                                type: "site"
                            },
                            triggers: [
                                ["wf:hover", {
                                        controlType: "standard",
                                        pluginConfig: {
                                            type: "mouseenter",
                                            hover: "each"
                                        }
                                    },
                                    ["wf:class", ["blog-card"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                ["wf:hover", {
                                        control: "reverse",
                                        controlType: "standard",
                                        pluginConfig: {
                                            type: "mouseleave",
                                            hover: "each"
                                        }
                                    },
                                    ["wf:class", ["blog-card"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                ["wf:hover", {
                                        controlType: "standard",
                                        pluginConfig: {
                                            type: "mouseenter",
                                            hover: "each"
                                        }
                                    },
                                    ["wf:class", ["program-single-card"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                ["wf:hover", {
                                        control: "reverse",
                                        controlType: "standard",
                                        pluginConfig: {
                                            type: "mouseleave",
                                            hover: "each"
                                        }
                                    },
                                    ["wf:class", ["program-single-card"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                ["wf:hover", {
                                        controlType: "standard",
                                        pluginConfig: {
                                            type: "mouseenter",
                                            hover: "each"
                                        }
                                    },
                                    ["wf:class", ["program-card"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                ["wf:hover", {
                                        control: "reverse",
                                        controlType: "standard",
                                        pluginConfig: {
                                            type: "mouseleave",
                                            hover: "each"
                                        }
                                    },
                                    ["wf:class", ["program-card"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ]
                            ],
                            timelineIds: ["t-8504d072"],
                            deleted: !1
                        }, {
                            id: "i-7475ecf6",
                            scope: {
                                type: "site"
                            },
                            triggers: [
                                ["wf:scroll", {
                                        controlType: "scroll",
                                        scrollTriggerConfig: {
                                            clamp: !0,
                                            start: "top bottom",
                                            end: "bottom top",
                                            scrub: null,
                                            enter: "play",
                                            leave: "none",
                                            enterBack: "none",
                                            leaveBack: "none"
                                        }
                                    },
                                    ["wf:class", ["faq-tab-link"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ]
                            ],
                            timelineIds: ["t-3e0705d0"],
                            deleted: !1
                        }, {
                            id: "i-6ab1bd11",
                            scope: {
                                type: "site"
                            },
                            triggers: [
                                ["wf:load", {
                                    controlType: "load"
                                }]
                            ],
                            timelineIds: ["t-d50602dd"],
                            deleted: !1
                        }, {
                            id: "i-f4621fe5",
                            scope: {
                                type: "site"
                            },
                            triggers: [
                                ["wf:hover", {
                                        controlType: "standard",
                                        pluginConfig: {
                                            type: "mouseenter",
                                            hover: "each"
                                        }
                                    },
                                    ["wf:class", ["gallery-image-wrapper"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                ["wf:hover", {
                                        control: "reverse",
                                        controlType: "standard",
                                        pluginConfig: {
                                            type: "mouseleave",
                                            hover: "each"
                                        }
                                    },
                                    ["wf:class", ["gallery-image-wrapper"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ]
                            ],
                            timelineIds: ["t-1d5a2039"],
                            deleted: !1
                        }, {
                            id: "i-ae0c33ca",
                            scope: {
                                type: "site"
                            },
                            triggers: [
                                ["wf:hover", {
                                        controlType: "standard",
                                        pluginConfig: {
                                            type: "mouseenter",
                                            hover: "each"
                                        }
                                    },
                                    ["wf:class", ["button"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ]
                            ],
                            timelineIds: ["t-159631d2"],
                            deleted: !1
                        }, {
                            id: "i-f8b5dbad",
                            scope: {
                                type: "pages",
                                value: ["69936ee0d4a65317864b055a"]
                            },
                            triggers: [
                                ["wf:scroll", {
                                        controlType: "scroll",
                                        scrollTriggerConfig: {
                                            clamp: !0,
                                            start: "top bottom",
                                            end: "bottom top",
                                            scrub: null,
                                            enter: "play",
                                            leave: "none",
                                            enterBack: "none",
                                            leaveBack: "none"
                                        }
                                    },
                                    ["wf:class", ["why-choose-us-img-wrap"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ]
                            ],
                            timelineIds: ["t-36ed9e15"],
                            deleted: !1
                        }], [{
                            id: "t-81ba15d0",
                            deleted: !1,
                            actions: [{
                                id: "ta-5e46a85d",
                                targets: [
                                    ["wf:class", ["banner-heading"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .25,
                                    position: .15,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        opacity: ["0%", "100%"],
                                        y: ["50px", "0px"]
                                    }
                                }
                            }, {
                                id: "ta-01da00b7",
                                targets: [
                                    ["wf:class", ["banner-paragraph"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .25,
                                    position: .15,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        opacity: ["0%", "100%"],
                                        y: ["50px", "0px"]
                                    }
                                }
                            }, {
                                id: "ta-155f1f3f",
                                targets: [
                                    ["wf:class", ["badge-label-wrap"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .25,
                                    position: .15,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        opacity: ["0%", "100%"],
                                        y: ["50px", "0px"]
                                    }
                                }
                            }, {
                                id: "ta-b7d3e5e5",
                                targets: [
                                    ["wf:class", ["banner-right-shape"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: 2,
                                    repeat: -1,
                                    yoyo: !0,
                                    position: 0,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        y: ["20px", "0px"]
                                    }
                                }
                            }, {
                                id: "ta-d4211b0d",
                                targets: [
                                    ["wf:class", ["banner-left-shape"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: 2,
                                    repeat: -1,
                                    yoyo: !0,
                                    position: 0,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        x: ["20px", "0px"]
                                    }
                                }
                            }]
                        }, {
                            id: "t-712f81e3",
                            deleted: !1,
                            actions: [{
                                id: "ta-52dec052",
                                targets: [
                                    ["wf:class", ["footer-ticker-list"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: 40,
                                    position: 0,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        x: ["0px", "-100%"]
                                    }
                                }
                            }],
                            settings: {
                                repeat: -1,
                                yoyo: !1
                            }
                        }, {
                            id: "t-377db625",
                            deleted: !1,
                            actions: [{
                                id: "ta-1232e6fb",
                                targets: [
                                    ["wf:trigger-only", "", {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .3,
                                    position: 0,
                                    stagger: {
                                        each: .3
                                    },
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        y: ["50px", "0px"]
                                    }
                                }
                            }]
                        }, {
                            id: "t-7b6ac40e",
                            deleted: !1,
                            actions: [{
                                id: "ta-f98f608c",
                                targets: [
                                    ["wf:trigger-only", "", {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .3,
                                    position: 0,
                                    stagger: {
                                        each: .3
                                    },
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        y: ["50px", "0px"]
                                    }
                                }
                            }]
                        }, {
                            id: "t-9aa91860",
                            deleted: !1,
                            actions: [{
                                id: "ta-199df2eb",
                                targets: [
                                    ["wf:trigger-only", "", {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .3,
                                    position: 0,
                                    stagger: {
                                        each: .3
                                    },
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        y: ["50px", "0px"]
                                    }
                                }
                            }]
                        }, {
                            id: "t-8504d072",
                            deleted: !1,
                            actions: [{
                                id: "ta-efdf72bf",
                                targets: [
                                    ["wf:class", ["button-icon-normal-left"], {
                                        relationship: "within",
                                        filterBy: ["wf:trigger-only", ""],
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .25,
                                    position: 0,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        x: ["0px", "22px"]
                                    },
                                    "wf:style": {
                                        backgroundColor: ["#1a1917", "#f8642b"]
                                    }
                                }
                            }, {
                                id: "ta-892c2fa8",
                                targets: [
                                    ["wf:class", ["button-icon-hover-left"], {
                                        relationship: "within",
                                        filterBy: ["wf:trigger-only", ""],
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .25,
                                    position: 0,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        x: ["0px", "22px"]
                                    },
                                    "wf:style": {
                                        backgroundColor: ["hsla(40, 6.12%, 9.61%, 1.00)", "hsla(14.536082474226806, 91.51%, 58.43%, 1.00)"]
                                    }
                                }
                            }, {
                                id: "ta-9c8f7421",
                                targets: [
                                    ["wf:selector", ".button-text", {
                                        relationship: "within",
                                        filterBy: ["wf:trigger-only", ""],
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .25,
                                    position: 0,
                                    ease: 1
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        y: ["0%", "0%"]
                                    }
                                }
                            }, {
                                id: "ta-35366e2f",
                                targets: [
                                    ["wf:class", ["cms-image"], {
                                        relationship: "within",
                                        filterBy: ["wf:trigger-only", ""],
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .3,
                                    position: 0,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        rotation: ["0deg", "1deg"],
                                        scale: [1, 1.09]
                                    }
                                }
                            }]
                        }, {
                            id: "t-3e0705d0",
                            deleted: !1,
                            actions: [{
                                id: "ta-1a5fb87a",
                                targets: [
                                    ["wf:trigger-only", "", {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .3,
                                    position: 0,
                                    stagger: {
                                        each: .3
                                    },
                                    ease: 25
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        y: ["50px", "0px"],
                                        opacity: ["0%", "100%"]
                                    }
                                }
                            }]
                        }, {
                            id: "t-d50602dd",
                            deleted: !1,
                            actions: [{
                                id: "ta-e2eb77c3",
                                targets: [
                                    ["wf:class", ["star-icon"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: 3,
                                    repeat: -1,
                                    yoyo: !0,
                                    position: 0,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        scale: [1, .7]
                                    }
                                }
                            }, {
                                id: "ta-3fe98124",
                                targets: [
                                    ["wf:class", ["star-icon-1"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }],
                                    ["wf:class", ["about-top-icon"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }],
                                    ["wf:class", ["sun-icon"], {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: 100,
                                    repeat: -1,
                                    yoyo: !1,
                                    position: 0,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        rotation: ["0deg", "5000deg"]
                                    }
                                }
                            }]
                        }, {
                            id: "t-1d5a2039",
                            deleted: !1,
                            actions: [{
                                id: "ta-66cbcb3f",
                                targets: [
                                    ["wf:class", ["gallery-text-warp"], {
                                        relationship: "within",
                                        filterBy: ["wf:trigger-only", ""],
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .3,
                                    position: 0,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        y: ["80px", "0px"]
                                    }
                                }
                            }, {
                                id: "ta-6f634aa0",
                                targets: [
                                    ["wf:class", ["gallery-image"], {
                                        relationship: "within",
                                        filterBy: ["wf:trigger-only", ""],
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    position: 0,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        scale: [1, 1.1]
                                    }
                                }
                            }]
                        }, {
                            id: "t-159631d2",
                            deleted: !1,
                            actions: [{
                                id: "ta-1e95e669",
                                targets: [
                                    ["wf:selector", ".button-text", {
                                        relationship: "within",
                                        filterBy: ["wf:trigger-only", ""],
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .3,
                                    position: 0,
                                    stagger: {
                                        amount: .3
                                    },
                                    ease: 2
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        y: ["0%", "-100%"]
                                    }
                                },
                                splitText: {
                                    type: "chars"
                                }
                            }]
                        }, {
                            id: "t-36ed9e15",
                            deleted: !1,
                            actions: [{
                                id: "ta-f42b7882",
                                targets: [
                                    ["wf:trigger-only", "", {
                                        relationship: "none",
                                        firstMatchOnly: !1
                                    }]
                                ],
                                timing: {
                                    duration: .3,
                                    position: 0,
                                    ease: 0
                                },
                                tt: 2,
                                properties: {
                                    "wf:transform": {
                                        y: ["50px", "0px"]
                                    }
                                }
                            }]
                        }]), window.dispatchEvent(new CustomEvent("__wf_ix3_ready")), document.documentElement.classList.add("w-mod-ix3"))
                    })
                }
                Webflow.require("ix2").init({
                    events: {
                        e: {
                            id: "e",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "NAVBAR_OPEN",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e-2"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "860625e3-7499-0c14-67be-9eb8acc43a29",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "860625e3-7499-0c14-67be-9eb8acc43a29",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19c82f04bc0
                        },
                        "e-2": {
                            id: "e-2",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "NAVBAR_CLOSE",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a-2",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "860625e3-7499-0c14-67be-9eb8acc43a29",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "860625e3-7499-0c14-67be-9eb8acc43a29",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19c82f04bc0
                        },
                        "e-3": {
                            id: "e-3",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "DROPDOWN_OPEN",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a-3",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e-4"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "860625e3-7499-0c14-67be-9eb8acc43a3b",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "860625e3-7499-0c14-67be-9eb8acc43a3b",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19c82f04bc0
                        },
                        "e-4": {
                            id: "e-4",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "DROPDOWN_CLOSE",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a-4",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e-3"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "860625e3-7499-0c14-67be-9eb8acc43a3b",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "860625e3-7499-0c14-67be-9eb8acc43a3b",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19c82f04bc0
                        },
                        "e-7": {
                            id: "e-7",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "DROPDOWN_OPEN",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a-3",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e-8"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "17a09bf0-7355-d914-5bd7-9f1324920de5",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "17a09bf0-7355-d914-5bd7-9f1324920de5",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19c83123d0d
                        },
                        "e-8": {
                            id: "e-8",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "DROPDOWN_CLOSE",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a-4",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e-7"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "17a09bf0-7355-d914-5bd7-9f1324920de5",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "17a09bf0-7355-d914-5bd7-9f1324920de5",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19c83123d0d
                        },
                        "e-13": {
                            id: "e-13",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-14"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "ff577e1d-a51a-3a83-4432-274e56c63a8c",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "ff577e1d-a51a-3a83-4432-274e56c63a8c",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 100,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c84147c2a
                        },
                        "e-15": {
                            id: "e-15",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-16"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "ff577e1d-a51a-3a83-4432-274e56c63a8f",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "ff577e1d-a51a-3a83-4432-274e56c63a8f",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c84149501
                        },
                        "e-17": {
                            id: "e-17",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-18"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "ff577e1d-a51a-3a83-4432-274e56c63a91",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "ff577e1d-a51a-3a83-4432-274e56c63a91",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c8414dff2
                        },
                        "e-19": {
                            id: "e-19",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-20"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "ff577e1d-a51a-3a83-4432-274e56c63a99",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "ff577e1d-a51a-3a83-4432-274e56c63a99",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c846fe805
                        },
                        "e-21": {
                            id: "e-21",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-22"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "ff577e1d-a51a-3a83-4432-274e56c63acc",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "ff577e1d-a51a-3a83-4432-274e56c63acc",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c84700e33
                        },
                        "e-23": {
                            id: "e-23",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-24"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69936ee0d4a65317864b055a|5a879aee-6d7e-9044-8717-f82f35f4df06",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69936ee0d4a65317864b055a|5a879aee-6d7e-9044-8717-f82f35f4df06",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "PX",
                                delay: 300,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c85e2bba0
                        },
                        "e-25": {
                            id: "e-25",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-26"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69936ee0d4a65317864b055a|61104a99-026a-c536-ce4f-bfdbf50e32c2",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69936ee0d4a65317864b055a|61104a99-026a-c536-ce4f-bfdbf50e32c2",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 100,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c861a2557
                        },
                        "e-27": {
                            id: "e-27",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-28"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69936ee0d4a65317864b055a|c86e5ce4-5b5f-c4b5-7d0c-19e73a56943a",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69936ee0d4a65317864b055a|c86e5ce4-5b5f-c4b5-7d0c-19e73a56943a",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c861a4584
                        },
                        "e-29": {
                            id: "e-29",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-30"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69936ee0d4a65317864b055a|f83d50fe-3958-d9d1-2122-16466b538909",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69936ee0d4a65317864b055a|f83d50fe-3958-d9d1-2122-16466b538909",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c861a63fc
                        },
                        "e-31": {
                            id: "e-31",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-32"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69936ee0d4a65317864b055a|f2c8481b-8c08-1f74-7619-48f6b90bb67d",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69936ee0d4a65317864b055a|f2c8481b-8c08-1f74-7619-48f6b90bb67d",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 400,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c861a841f
                        },
                        "e-34": {
                            id: "e-34",
                            name: "",
                            animationType: "custom",
                            eventTypeId: "SCROLLING_IN_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_CONTINUOUS_ACTION",
                                config: {
                                    actionListId: "a-9",
                                    affectedElements: {},
                                    duration: 0
                                }
                            },
                            mediaQueries: ["main"],
                            target: {
                                id: "69936ee0d4a65317864b055a|db981104-49cd-0eac-ca2a-ccf06d5d5d4f",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69936ee0d4a65317864b055a|db981104-49cd-0eac-ca2a-ccf06d5d5d4f",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: [{
                                continuousParameterGroupId: "a-9-p",
                                smoothing: 90,
                                startsEntering: !0,
                                addStartOffset: !1,
                                addOffsetValue: 50,
                                startsExiting: !1,
                                addEndOffset: !1,
                                endOffsetValue: 50
                            }],
                            createdOn: 0x19c86a6399d
                        },
                        "e-36": {
                            id: "e-36",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-37"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".section-title-wrapper",
                                originalId: "69936ee0d4a65317864b055a|fa7fdfc0-4fe9-2729-10a2-1904eb9d2d1b",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".section-title-wrapper",
                                originalId: "69936ee0d4a65317864b055a|fa7fdfc0-4fe9-2729-10a2-1904eb9d2d1b",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 100,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c8912528a
                        },
                        "e-38": {
                            id: "e-38",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-39"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".button-area",
                                originalId: "69936ee0d4a65317864b055a|4946d3ca-b4d2-4e16-06a5-c3601fc95c47",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".button-area",
                                originalId: "69936ee0d4a65317864b055a|4946d3ca-b4d2-4e16-06a5-c3601fc95c47",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 100,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c8934a454
                        },
                        "e-40": {
                            id: "e-40",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "GROW_BIG_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "growBigIn",
                                    autoStopEventId: "e-41"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69936ee0d4a65317864b055a|dbe9ba98-80ea-6aac-f569-ad06e27b8fcb",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69936ee0d4a65317864b055a|dbe9ba98-80ea-6aac-f569-ad06e27b8fcb",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: null,
                                effectIn: !0
                            },
                            createdOn: 0x19c89b5f2e3
                        },
                        "e-42": {
                            id: "e-42",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "GROW_BIG_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "growBigIn",
                                    autoStopEventId: "e-43"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69936ee0d4a65317864b055a|6219be2b-5021-bbbf-f409-42bc0e9e66f5",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69936ee0d4a65317864b055a|6219be2b-5021-bbbf-f409-42bc0e9e66f5",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: null,
                                effectIn: !0
                            },
                            createdOn: 0x19c89b61441
                        },
                        "e-44": {
                            id: "e-44",
                            name: "",
                            animationType: "custom",
                            eventTypeId: "TAB_ACTIVE",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a-11",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e-45"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".faq-tab-link",
                                originalId: "da55e9cb-59da-cfc2-dd8e-836415b2ab72",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".faq-tab-link",
                                originalId: "da55e9cb-59da-cfc2-dd8e-836415b2ab72",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19bea7b1fe6
                        },
                        "e-45": {
                            id: "e-45",
                            name: "",
                            animationType: "custom",
                            eventTypeId: "TAB_INACTIVE",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a-12",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e-44"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".faq-tab-link",
                                originalId: "da55e9cb-59da-cfc2-dd8e-836415b2ab72",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".faq-tab-link",
                                originalId: "da55e9cb-59da-cfc2-dd8e-836415b2ab72",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19bea7b1fe7
                        },
                        "e-46": {
                            id: "e-46",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-47"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69936ee0d4a65317864b055a|269c84b1-db5c-e3e3-b9bb-a9b8ae0e8359",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69936ee0d4a65317864b055a|269c84b1-db5c-e3e3-b9bb-a9b8ae0e8359",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c8ab3eaf1
                        },
                        "e-48": {
                            id: "e-48",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInLeft",
                                    autoStopEventId: "e-49"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699c34314cdaa993d7cafa39|7ef626d2-f28a-8a70-908a-af8a4c895411",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699c34314cdaa993d7cafa39|7ef626d2-f28a-8a70-908a-af8a4c895411",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c8ac25850
                        },
                        "e-50": {
                            id: "e-50",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInRight",
                                    autoStopEventId: "e-51"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699c34314cdaa993d7cafa39|1150d091-973f-6563-9433-9bcf4b0e4492",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699c34314cdaa993d7cafa39|1150d091-973f-6563-9433-9bcf4b0e4492",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "RIGHT",
                                effectIn: !0
                            },
                            createdOn: 0x19c8ac2836d
                        },
                        "e-52": {
                            id: "e-52",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-53"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699c34314cdaa993d7cafa39|6ed2218e-354a-4e35-54f9-694150bd8cdd",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699c34314cdaa993d7cafa39|6ed2218e-354a-4e35-54f9-694150bd8cdd",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c8acac99e
                        },
                        "e-54": {
                            id: "e-54",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-55"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699c34314cdaa993d7cafa39|f99d0a7c-ccc1-8f39-b014-a5c250065a4b",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699c34314cdaa993d7cafa39|f99d0a7c-ccc1-8f39-b014-a5c250065a4b",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c8acae7bf
                        },
                        "e-56": {
                            id: "e-56",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "FLIP_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "flipInLeft",
                                    autoStopEventId: "e-57"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "cbeadc66-f4b7-42ac-fb89-808c3feb1532",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "cbeadc66-f4b7-42ac-fb89-808c3feb1532",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c8ae28e8b
                        },
                        "e-58": {
                            id: "e-58",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "FLIP_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "flipInLeft",
                                    autoStopEventId: "e-59"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "5fc8af9f-c031-e866-16c8-ca165494dc1c",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "5fc8af9f-c031-e866-16c8-ca165494dc1c",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c8ae3d24c
                        },
                        "e-60": {
                            id: "e-60",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "FLIP_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "flipInLeft",
                                    autoStopEventId: "e-61"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699c34314cdaa993d7cafa39|5fc8af9f-c031-e866-16c8-ca165494dc1b",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699c34314cdaa993d7cafa39|5fc8af9f-c031-e866-16c8-ca165494dc1b",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c8ae8e9e1
                        },
                        "e-62": {
                            id: "e-62",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "FLIP_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "flipInLeft",
                                    autoStopEventId: "e-63"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".blog-card",
                                originalId: "69936ee0d4a65317864b055a|ea941835-123c-5216-c1fe-a19bc3300292",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".blog-card",
                                originalId: "69936ee0d4a65317864b055a|ea941835-123c-5216-c1fe-a19bc3300292",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c8afc3f87
                        },
                        "e-64": {
                            id: "e-64",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-65"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69936ee0d4a65317864b055a|cf2f9d7f-798f-7c11-9c40-5a30a6528918",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69936ee0d4a65317864b055a|cf2f9d7f-798f-7c11-9c40-5a30a6528918",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c8aff5de9
                        },
                        "e-66": {
                            id: "e-66",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-67"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "ff577e1d-a51a-3a83-4432-274e56c63ae1",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "ff577e1d-a51a-3a83-4432-274e56c63ae1",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c8b05eeb9
                        },
                        "e-97": {
                            id: "e-97",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-98"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".about-content-list",
                                originalId: "699c7036cb5a50a4f3acafa6|00e942ca-0efb-aa35-1183-b6c39a89c6dd",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".about-content-list",
                                originalId: "699c7036cb5a50a4f3acafa6|00e942ca-0efb-aa35-1183-b6c39a89c6dd",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c8d4ea121
                        },
                        "e-125": {
                            id: "e-125",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-126"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".schedule-item",
                                originalId: "699d17984eda6e70bf2057d7|e0016dd8-1252-0b0f-d047-95c492c777b3",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".schedule-item",
                                originalId: "699d17984eda6e70bf2057d7|e0016dd8-1252-0b0f-d047-95c492c777b3",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c8daef228
                        },
                        "e-127": {
                            id: "e-127",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-128"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699d17984eda6e70bf2057d7|785dc276-fe10-ff93-f9d2-285e53ea3b37",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699d17984eda6e70bf2057d7|785dc276-fe10-ff93-f9d2-285e53ea3b37",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c8dc30667
                        },
                        "e-130": {
                            id: "e-130",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-131"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699d544e0a6cc1d402f70bda|40b63644-3594-fc47-8609-bbce046ded94",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699d544e0a6cc1d402f70bda|40b63644-3594-fc47-8609-bbce046ded94",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c8efe399b
                        },
                        "e-132": {
                            id: "e-132",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "FLIP_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "flipInLeft",
                                    autoStopEventId: "e-133"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699d544e0a6cc1d402f70bda|378327c3-00d7-0c0a-e26b-d04b066ab519",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699d544e0a6cc1d402f70bda|378327c3-00d7-0c0a-e26b-d04b066ab519",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c8f13e8db
                        },
                        "e-134": {
                            id: "e-134",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "FLIP_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "flipInLeft",
                                    autoStopEventId: "e-135"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699d544e0a6cc1d402f70bda|9e2446a9-80aa-4b61-300c-c9cab54f82b7",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699d544e0a6cc1d402f70bda|9e2446a9-80aa-4b61-300c-c9cab54f82b7",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c8f141f18
                        },
                        "e-136": {
                            id: "e-136",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "FLIP_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "flipInLeft",
                                    autoStopEventId: "e-137"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699d544e0a6cc1d402f70bda|9541122f-a240-f04a-cbbf-3dc203cff763",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699d544e0a6cc1d402f70bda|9541122f-a240-f04a-cbbf-3dc203cff763",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c8f1420eb
                        },
                        "e-138": {
                            id: "e-138",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "FLIP_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "flipInLeft",
                                    autoStopEventId: "e-139"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699d544e0a6cc1d402f70bda|a42d67f4-2ad0-9f64-c41a-014f0b84d2bc",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699d544e0a6cc1d402f70bda|a42d67f4-2ad0-9f64-c41a-014f0b84d2bc",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c8f142303
                        },
                        "e-141": {
                            id: "e-141",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "PAGE_START",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a-13",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e-142"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699dc0fd65d14fec14da35de",
                                appliesTo: "PAGE",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699dc0fd65d14fec14da35de",
                                appliesTo: "PAGE",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !0,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19c9039e530
                        },
                        "e-143": {
                            id: "e-143",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-144"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699dc0fd65d14fec14da35de|b3dae11c-8e0b-9893-44fe-0922fc6c5fc0",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699dc0fd65d14fec14da35de|b3dae11c-8e0b-9893-44fe-0922fc6c5fc0",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 100,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9520db0f
                        },
                        "e-145": {
                            id: "e-145",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-146"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".food-item",
                                originalId: "699dc0fd65d14fec14da35de|76908500-f271-3528-b757-1506403a3881",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".food-item",
                                originalId: "699dc0fd65d14fec14da35de|76908500-f271-3528-b757-1506403a3881",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 100,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9520f71e
                        },
                        "e-147": {
                            id: "e-147",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "PAGE_START",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a-13",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e-148"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699f027cf676b77ac6de3ced",
                                appliesTo: "PAGE",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699f027cf676b77ac6de3ced",
                                appliesTo: "PAGE",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !0,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19c9521b945
                        },
                        "e-149": {
                            id: "e-149",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-150"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699f027cf676b77ac6de3ced|29fd2330-2dbd-4487-269f-119bfaa1578e",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699f027cf676b77ac6de3ced|29fd2330-2dbd-4487-269f-119bfaa1578e",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c98ccfb66
                        },
                        "e-151": {
                            id: "e-151",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-152"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".document-card",
                                originalId: "699f027cf676b77ac6de3ced|93716259-9a86-61e4-a7ad-677c31783859",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".document-card",
                                originalId: "699f027cf676b77ac6de3ced|93716259-9a86-61e4-a7ad-677c31783859",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 500,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c98cd35dd
                        },
                        "e-153": {
                            id: "e-153",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "PAGE_START",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a-13",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e-154"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699ff4805490afef75e017b8",
                                appliesTo: "PAGE",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699ff4805490afef75e017b8",
                                appliesTo: "PAGE",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !0,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19c98d315d2
                        },
                        "e-155": {
                            id: "e-155",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-156"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699ff4805490afef75e017b8|27eedc08-1cf6-b9f7-5639-cdc7cb4492fe",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699ff4805490afef75e017b8|27eedc08-1cf6-b9f7-5639-cdc7cb4492fe",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9916034e
                        },
                        "e-157": {
                            id: "e-157",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-158"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699ff4805490afef75e017b8|3529ef06-16ce-c92a-9914-6925ddcb6477",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699ff4805490afef75e017b8|3529ef06-16ce-c92a-9914-6925ddcb6477",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c99168cde
                        },
                        "e-159": {
                            id: "e-159",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "FLIP_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "flipInLeft",
                                    autoStopEventId: "e-160"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".packing-lits-card",
                                originalId: "699ff4805490afef75e017b8|694504d6-de4e-dec9-a398-46545ed64fcd",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".packing-lits-card",
                                originalId: "699ff4805490afef75e017b8|694504d6-de4e-dec9-a398-46545ed64fcd",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c99267c5e
                        },
                        "e-161": {
                            id: "e-161",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-162"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".daily-flow-card",
                                originalId: "699ff4805490afef75e017b8|5e25bad0-7361-98f9-c15f-9fed96e706a7",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".daily-flow-card",
                                originalId: "699ff4805490afef75e017b8|5e25bad0-7361-98f9-c15f-9fed96e706a7",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9939b308
                        },
                        "e-163": {
                            id: "e-163",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "PAGE_START",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a-13",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e-164"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a00f9f2938d56a1c1a8c29",
                                appliesTo: "PAGE",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69a00f9f2938d56a1c1a8c29",
                                appliesTo: "PAGE",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !0,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19c993d0b21
                        },
                        "e-165": {
                            id: "e-165",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "FLIP_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "flipInLeft",
                                    autoStopEventId: "e-166"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".gallery-image-wrapper",
                                originalId: "69a00f9f2938d56a1c1a8c29|b973c175-0ca2-7887-f23e-8f627730ec61",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".gallery-image-wrapper",
                                originalId: "69a00f9f2938d56a1c1a8c29|b973c175-0ca2-7887-f23e-8f627730ec61",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c995739f4
                        },
                        "e-168": {
                            id: "e-168",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-169"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a018e8aa72e3c6a6de9164|2fa74bd5-3839-711a-c0c9-4148c5fabd63",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69a018e8aa72e3c6a6de9164|2fa74bd5-3839-711a-c0c9-4148c5fabd63",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c996a57d2
                        },
                        "e-171": {
                            id: "e-171",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-172"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a01bfcb0aa8c422ebf5932|07adfc5f-c38c-aad8-e65b-79708bd26170",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69a01bfcb0aa8c422ebf5932|07adfc5f-c38c-aad8-e65b-79708bd26170",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c997492b2
                        },
                        "e-173": {
                            id: "e-173",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-174"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".privacy-feature",
                                originalId: "69a06f166f43b546f4857ad2|0520398a-1d6b-1dd4-d6f0-1d1cbbf40ac1",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".privacy-feature",
                                originalId: "69a06f166f43b546f4857ad2|0520398a-1d6b-1dd4-d6f0-1d1cbbf40ac1",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9ab5549f
                        },
                        "e-175": {
                            id: "e-175",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-176"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".license-item",
                                originalId: "69a0701d93ff1177dad1d2f5|7e9da9dd-f9f4-5b8e-ec6f-82b50e141ad2",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".license-item",
                                originalId: "69a0701d93ff1177dad1d2f5|7e9da9dd-f9f4-5b8e-ec6f-82b50e141ad2",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9ad645b5
                        },
                        "e-177": {
                            id: "e-177",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-178"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: "._404-image",
                                originalId: "69a07a1a0a3f6598afb1a102|b17f8c62-0299-541f-6381-a09e3d5e1d8a",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: "._404-image",
                                originalId: "69a07a1a0a3f6598afb1a102|b17f8c62-0299-541f-6381-a09e3d5e1d8a",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9ae3609e
                        },
                        "e-179": {
                            id: "e-179",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-180"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a07a1a0a3f6598afb1a102|bbcb508d-bdd3-1973-3273-ae7688418c80",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "69a07a1a0a3f6598afb1a102|bbcb508d-bdd3-1973-3273-ae7688418c80",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9ae395d2
                        },
                        "e-181": {
                            id: "e-181",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-182"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".program-single-card",
                                originalId: "699d0d9c6ba9c609a9a4e526|83634a82-f259-ed76-1b6e-7d5897093ec4",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".program-single-card",
                                originalId: "699d0d9c6ba9c609a9a4e526|83634a82-f259-ed76-1b6e-7d5897093ec4",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9b15dd3c
                        },
                        "e-183": {
                            id: "e-183",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-184"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699b5df4a588f154f5748c71|82bba523-e492-a2bf-4df4-8adcf2d32ac3",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699b5df4a588f154f5748c71|82bba523-e492-a2bf-4df4-8adcf2d32ac3",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 100,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9b1daff4
                        },
                        "e-185": {
                            id: "e-185",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-186"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699ff4805490afef75e017b8|b6df77c4-c689-fcb7-e9a3-517e5169983a",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699ff4805490afef75e017b8|b6df77c4-c689-fcb7-e9a3-517e5169983a",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9b229c2c
                        },
                        "e-187": {
                            id: "e-187",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-188"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".helpful-tips-content-block",
                                originalId: "699ff4805490afef75e017b8|b6df77c4-c689-fcb7-e9a3-517e51699817",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".helpful-tips-content-block",
                                originalId: "699ff4805490afef75e017b8|b6df77c4-c689-fcb7-e9a3-517e51699817",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9b22dbdb
                        },
                        "e-189": {
                            id: "e-189",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "GROW_BIG_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "growBigIn",
                                    autoStopEventId: "e-190"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".star-icon-1.resource-1",
                                originalId: "699ff4805490afef75e017b8|b6df77c4-c689-fcb7-e9a3-517e5169983b",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".star-icon-1.resource-1",
                                originalId: "699ff4805490afef75e017b8|b6df77c4-c689-fcb7-e9a3-517e5169983b",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 500,
                                direction: null,
                                effectIn: !0
                            },
                            createdOn: 0x19c9b233bbd
                        },
                        "e-191": {
                            id: "e-191",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "GROW_BIG_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "growBigIn",
                                    autoStopEventId: "e-192"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".sun-icon.resource-1",
                                originalId: "699ff4805490afef75e017b8|b6df77c4-c689-fcb7-e9a3-517e5169983c",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".sun-icon.resource-1",
                                originalId: "699ff4805490afef75e017b8|b6df77c4-c689-fcb7-e9a3-517e5169983c",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 500,
                                direction: null,
                                effectIn: !0
                            },
                            createdOn: 0x19c9b2364dc
                        },
                        "e-193": {
                            id: "e-193",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInRight",
                                    autoStopEventId: "e-194"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699ff4805490afef75e017b8|05971e09-df74-7bf9-fbb1-25d5dcb8fa63",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699ff4805490afef75e017b8|05971e09-df74-7bf9-fbb1-25d5dcb8fa63",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 600,
                                direction: "RIGHT",
                                effectIn: !0
                            },
                            createdOn: 0x19c9b239eb4
                        },
                        "e-195": {
                            id: "e-195",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInLeft",
                                    autoStopEventId: "e-196"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699ff4805490afef75e017b8|1bda382d-45cb-8b7b-13fd-e46327c27aba",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699ff4805490afef75e017b8|1bda382d-45cb-8b7b-13fd-e46327c27aba",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 600,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c9b249885
                        },
                        "e-197": {
                            id: "e-197",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-198"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699ff4805490afef75e017b8|b6df77c4-c689-fcb7-e9a3-517e51699840",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699ff4805490afef75e017b8|b6df77c4-c689-fcb7-e9a3-517e51699840",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9b24db7e
                        },
                        "e-199": {
                            id: "e-199",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "FLIP_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "flipInLeft",
                                    autoStopEventId: "e-200"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".approach-card",
                                originalId: "699c7036cb5a50a4f3acafa6|4f07722e-b036-5eb3-07af-8e7e16deacff",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".approach-card",
                                originalId: "699c7036cb5a50a4f3acafa6|4f07722e-b036-5eb3-07af-8e7e16deacff",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 300,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19c9b9081c0
                        },
                        "e-201": {
                            id: "e-201",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "DROP_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "dropIn",
                                    autoStopEventId: "e-202"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".banner-icon",
                                originalId: "f3d748e9-7385-74ea-b61a-fa465f74ec6a",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".banner-icon",
                                originalId: "f3d748e9-7385-74ea-b61a-fa465f74ec6a",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 500,
                                direction: null,
                                effectIn: !0
                            },
                            createdOn: 0x19c9b995c9f
                        },
                        "e-203": {
                            id: "e-203",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-204"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".program-body-content",
                                originalId: "699b5df4a588f154f5748c71|20381386-c8e0-ad2a-5222-32dcf668ca51",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".program-body-content",
                                originalId: "699b5df4a588f154f5748c71|20381386-c8e0-ad2a-5222-32dcf668ca51",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9ba2da10
                        },
                        "e-205": {
                            id: "e-205",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-206"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699b5df4a588f154f5748c71|1b1c748b-a194-0911-cc25-537f54d35be5",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699b5df4a588f154f5748c71|1b1c748b-a194-0911-cc25-537f54d35be5",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9ba2feb7
                        },
                        "e-207": {
                            id: "e-207",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-208"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "699b5df4a588f154f5748c71|01963a88-8d35-08de-e478-90deebdcdcae",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [{
                                id: "699b5df4a588f154f5748c71|01963a88-8d35-08de-e478-90deebdcdcae",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9ba496c7
                        },
                        "e-209": {
                            id: "e-209",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-210"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                selector: ".single-styleguide",
                                originalId: "699a59b9ad2eb0cdf01c0209|023765e8-ded6-918c-163f-b467086048d3",
                                appliesTo: "CLASS"
                            },
                            targets: [{
                                selector: ".single-styleguide",
                                originalId: "699a59b9ad2eb0cdf01c0209|023765e8-ded6-918c-163f-b467086048d3",
                                appliesTo: "CLASS"
                            }],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19c9bb64e4b
                        },
                        "e-211": {
                            id: "e-211",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLLING_IN_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_CONTINUOUS_ACTION",
                                config: {
                                    actionListId: "a-9",
                                    affectedElements: {},
                                    duration: 0
                                }
                            },
                            mediaQueries: ["main"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97|4f07722e-b036-5eb3-07af-8e7e16deacf8",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: [{
                                continuousParameterGroupId: "a-9-p",
                                smoothing: 90,
                                startsEntering: !0,
                                addStartOffset: !1,
                                addOffsetValue: 50,
                                startsExiting: !1,
                                addEndOffset: !1,
                                endOffsetValue: 50
                            }],
                            createdOn: 0x19ca990acbd
                        },
                        "e-212": {
                            id: "e-212",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "PAGE_START",
                            action: {
                                id: "",
                                actionTypeId: "GENERAL_START_ACTION",
                                config: {
                                    delay: 0,
                                    easing: "",
                                    duration: 0,
                                    actionListId: "a-13",
                                    affectedElements: {},
                                    playInReverse: !1,
                                    autoStopEventId: "e-213"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97",
                                appliesTo: "PAGE",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: {
                                loop: !0,
                                playInReverse: !1,
                                scrollOffsetValue: null,
                                scrollOffsetUnit: null,
                                delay: null,
                                direction: null,
                                effectIn: null
                            },
                            createdOn: 0x19ca990acbd
                        },
                        "e-214": {
                            id: "e-214",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-215"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97|d694068c-1828-dc30-a032-51609c2a6b90",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 400,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19ca990acbd
                        },
                        "e-216": {
                            id: "e-216",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-217"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97|ed1032e4-fc5a-e9b9-3c35-82dfdd1d243c",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 0,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19ca990acbd
                        },
                        "e-218": {
                            id: "e-218",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-219"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97|4299619c-cea9-9fe5-b044-2d6b16d98536",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19ca990acbd
                        },
                        "e-220": {
                            id: "e-220",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "GROW_BIG_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "growBigIn",
                                    autoStopEventId: "e-221"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97|ef5c3614-a109-16e1-ccb8-2c6f6438cd2a",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 800,
                                direction: null,
                                effectIn: !0
                            },
                            createdOn: 0x19ca990acbd
                        },
                        "e-222": {
                            id: "e-222",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "GROW_BIG_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "growBigIn",
                                    autoStopEventId: "e-223"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97|041013f4-8ddf-35c7-4d2d-e4d2e7fc1262",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 500,
                                direction: null,
                                effectIn: !0
                            },
                            createdOn: 0x19ca990acbd
                        },
                        "e-224": {
                            id: "e-224",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "GROW_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "growIn",
                                    autoStopEventId: "e-225"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97|a79c6d9e-3370-5095-1b75-97e419c47951",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 500,
                                direction: null,
                                effectIn: !0
                            },
                            createdOn: 0x19ca990acbd
                        },
                        "e-226": {
                            id: "e-226",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-227"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97|2fcbd1ba-d630-39df-b54c-a35052337bc7",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19ca990acbd
                        },
                        "e-228": {
                            id: "e-228",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "GROW_BIG_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "growBigIn",
                                    autoStopEventId: "e-229"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97|35228526-f055-94c9-f832-81a659b6034b",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 400,
                                direction: null,
                                effectIn: !0
                            },
                            createdOn: 0x19ca990acbd
                        },
                        "e-230": {
                            id: "e-230",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "GROW_BIG_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "growBigIn",
                                    autoStopEventId: "e-231"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97|a6432d0a-c10e-6208-ccfb-c70a64389104",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 400,
                                direction: null,
                                effectIn: !0
                            },
                            createdOn: 0x19ca990acbd
                        },
                        "e-232": {
                            id: "e-232",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInLeft",
                                    autoStopEventId: "e-233"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97|9f3d6d1e-b6da-f9ca-c809-5167882aa225",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 400,
                                direction: "LEFT",
                                effectIn: !0
                            },
                            createdOn: 0x19ca990acbd
                        },
                        "e-234": {
                            id: "e-234",
                            name: "",
                            animationType: "preset",
                            eventTypeId: "SCROLL_INTO_VIEW",
                            action: {
                                id: "",
                                actionTypeId: "SLIDE_EFFECT",
                                instant: !1,
                                config: {
                                    actionListId: "slideInBottom",
                                    autoStopEventId: "e-235"
                                }
                            },
                            mediaQueries: ["main", "medium", "small", "tiny"],
                            target: {
                                id: "69a43d9c9c48a9f1a8a65c97|1e5255fa-1e2c-5b49-cf2b-6ad0158164dd",
                                appliesTo: "ELEMENT",
                                styleBlockIds: []
                            },
                            targets: [],
                            config: {
                                loop: !1,
                                playInReverse: !1,
                                scrollOffsetValue: 0,
                                scrollOffsetUnit: "%",
                                delay: 200,
                                direction: "BOTTOM",
                                effectIn: !0
                            },
                            createdOn: 0x19ca990acbd
                        }
                    },
                    actionLists: {
                        a: {
                            id: "a",
                            title: "Menu open",
                            actionItemGroups: [{
                                actionItems: [{
                                    id: "a-n",
                                    actionTypeId: "PLUGIN_LOTTIE",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".menu-button-icon",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382e3"]
                                        },
                                        value: 35
                                    }
                                }]
                            }],
                            useFirstGroupAsInitialState: !1,
                            createdOn: 0x1953789d261
                        },
                        "a-2": {
                            id: "a-2",
                            title: "Menu Close",
                            actionItemGroups: [{
                                actionItems: [{
                                    id: "a-2-n",
                                    actionTypeId: "PLUGIN_LOTTIE",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".menu-button-icon",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382e3"]
                                        },
                                        value: 0
                                    }
                                }]
                            }],
                            useFirstGroupAsInitialState: !1,
                            createdOn: 0x1953789d261
                        },
                        "a-3": {
                            id: "a-3",
                            title: "Dropdown  Open - Large",
                            actionItemGroups: [{
                                actionItems: [{
                                    id: "a-3-n",
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 400,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".mega-menu",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382f3"]
                                        },
                                        yValue: 20,
                                        xUnit: "PX",
                                        yUnit: "px",
                                        zUnit: "PX"
                                    }
                                }, {
                                    id: "a-3-n-2",
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 500,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".mega-menu",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382f3"]
                                        },
                                        value: 0,
                                        unit: ""
                                    }
                                }, {
                                    id: "a-3-n-7",
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 400,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".parents-menu-wrapper",
                                            selectorGuids: ["afa36781-a829-4adb-d66a-75e8ce6f7de1"]
                                        },
                                        yValue: 20,
                                        xUnit: "PX",
                                        yUnit: "px",
                                        zUnit: "PX"
                                    }
                                }, {
                                    id: "a-3-n-8",
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 500,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".parents-menu-wrapper",
                                            selectorGuids: ["afa36781-a829-4adb-d66a-75e8ce6f7de1"]
                                        },
                                        value: 0,
                                        unit: ""
                                    }
                                }, {
                                    id: "a-3-n-14",
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 0,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".nav-dropdown-icon.normal",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382e4", "a92f6695-f0ff-7219-3313-18348c0277e7"]
                                        },
                                        value: 1,
                                        unit: ""
                                    }
                                }, {
                                    id: "a-3-n-11",
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 500,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".nav-dropdown-icon.active",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382e4", "3266e0e4-5e15-5099-c6b8-fc6b0914bb3a"]
                                        },
                                        value: 0,
                                        unit: ""
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    id: "a-3-n-4",
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        easing: "ease",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".mega-menu",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382f3"]
                                        },
                                        yValue: 0,
                                        xUnit: "PX",
                                        yUnit: "px",
                                        zUnit: "PX"
                                    }
                                }, {
                                    id: "a-3-n-5",
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "ease",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".mega-menu",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382f3"]
                                        },
                                        value: 1,
                                        unit: ""
                                    }
                                }, {
                                    id: "a-3-n-6",
                                    actionTypeId: "STYLE_TEXT_COLOR",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".nav-dropdown-toggle",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382df"]
                                        },
                                        globalSwatchId: "--_colors---primary-color",
                                        rValue: 248,
                                        bValue: 43,
                                        gValue: 100,
                                        aValue: 1
                                    }
                                }, {
                                    id: "a-3-n-9",
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        easing: "ease",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".parents-menu-wrapper",
                                            selectorGuids: ["afa36781-a829-4adb-d66a-75e8ce6f7de1"]
                                        },
                                        yValue: 0,
                                        xUnit: "PX",
                                        yUnit: "px",
                                        zUnit: "PX"
                                    }
                                }, {
                                    id: "a-3-n-10",
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "ease",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".parents-menu-wrapper",
                                            selectorGuids: ["afa36781-a829-4adb-d66a-75e8ce6f7de1"]
                                        },
                                        value: 1,
                                        unit: ""
                                    }
                                }, {
                                    id: "a-3-n-3",
                                    actionTypeId: "TRANSFORM_ROTATE",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".nav-dropdown-icon",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382e4"]
                                        },
                                        xValue: null,
                                        zValue: 180,
                                        xUnit: "deg",
                                        yUnit: "DEG",
                                        zUnit: "deg"
                                    }
                                }, {
                                    id: "a-3-n-12",
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 0,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".nav-dropdown-icon.normal",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382e4", "a92f6695-f0ff-7219-3313-18348c0277e7"]
                                        },
                                        value: 0,
                                        unit: ""
                                    }
                                }, {
                                    id: "a-3-n-13",
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".nav-dropdown-icon.active",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382e4", "3266e0e4-5e15-5099-c6b8-fc6b0914bb3a"]
                                        },
                                        value: 1,
                                        unit: ""
                                    }
                                }]
                            }],
                            useFirstGroupAsInitialState: !0,
                            createdOn: 0x195384453ad
                        },
                        "a-4": {
                            id: "a-4",
                            title: "Dropdown  Close -  Large",
                            actionItemGroups: [{
                                actionItems: [{
                                    id: "a-4-n",
                                    actionTypeId: "TRANSFORM_ROTATE",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".nav-dropdown-icon",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382e4"]
                                        },
                                        xValue: null,
                                        zValue: 0,
                                        xUnit: "deg",
                                        yUnit: "DEG",
                                        zUnit: "deg"
                                    }
                                }, {
                                    id: "a-4-n-2",
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        easing: "ease",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".mega-menu",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382f3"]
                                        },
                                        yValue: 30,
                                        xUnit: "PX",
                                        yUnit: "px",
                                        zUnit: "PX"
                                    }
                                }, {
                                    id: "a-4-n-3",
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "ease",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".mega-menu",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382f3"]
                                        },
                                        value: 0,
                                        unit: ""
                                    }
                                }, {
                                    id: "a-4-n-4",
                                    actionTypeId: "STYLE_TEXT_COLOR",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".nav-dropdown-toggle",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382df"]
                                        },
                                        globalSwatchId: "--_colors---black",
                                        rValue: 26,
                                        bValue: 23,
                                        gValue: 25,
                                        aValue: 1
                                    }
                                }, {
                                    id: "a-4-n-6",
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "ease",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".parents-menu-wrapper",
                                            selectorGuids: ["afa36781-a829-4adb-d66a-75e8ce6f7de1"]
                                        },
                                        value: 0,
                                        unit: ""
                                    }
                                }, {
                                    id: "a-4-n-5",
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        easing: "ease",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".parents-menu-wrapper",
                                            selectorGuids: ["afa36781-a829-4adb-d66a-75e8ce6f7de1"]
                                        },
                                        yValue: 30,
                                        xUnit: "PX",
                                        yUnit: "px",
                                        zUnit: "PX"
                                    }
                                }, {
                                    id: "a-4-n-8",
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".nav-dropdown-icon.normal",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382e4", "a92f6695-f0ff-7219-3313-18348c0277e7"]
                                        },
                                        value: 1,
                                        unit: ""
                                    }
                                }, {
                                    id: "a-4-n-7",
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 0,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".nav-dropdown-icon.active",
                                            selectorGuids: ["5958e4d8-b38f-d4ae-0a7b-2044841382e4", "3266e0e4-5e15-5099-c6b8-fc6b0914bb3a"]
                                        },
                                        value: 0,
                                        unit: ""
                                    }
                                }]
                            }],
                            useFirstGroupAsInitialState: !1,
                            createdOn: 0x195384453ad
                        },
                        "a-9": {
                            id: "a-9",
                            title: "Our Approach Section",
                            continuousParameterGroups: [{
                                id: "a-9-p",
                                type: "SCROLL_PROGRESS",
                                parameterLabel: "Scroll",
                                continuousActionGroups: [{
                                    keyframe: 0,
                                    actionItems: [{
                                        id: "a-9-n",
                                        actionTypeId: "TRANSFORM_MOVE",
                                        config: {
                                            delay: 0,
                                            easing: "",
                                            duration: 500,
                                            target: {
                                                useEventTarget: "CHILDREN",
                                                selector: ".approach-card._1",
                                                selectorGuids: ["79312cd2-4ae3-9a3e-3d2c-ffdfd2816aef", "b0e4fe37-b239-3bcf-314c-b731b82d0ac4"]
                                            },
                                            yValue: 0,
                                            xUnit: "PX",
                                            yUnit: "px",
                                            zUnit: "PX"
                                        }
                                    }, {
                                        id: "a-9-n-3",
                                        actionTypeId: "TRANSFORM_MOVE",
                                        config: {
                                            delay: 0,
                                            easing: "",
                                            duration: 500,
                                            target: {
                                                useEventTarget: "CHILDREN",
                                                selector: ".approach-card._2",
                                                selectorGuids: ["79312cd2-4ae3-9a3e-3d2c-ffdfd2816aef", "b9cec0ff-8242-8d0f-5899-375f9bc5af55"]
                                            },
                                            yValue: -100,
                                            xUnit: "PX",
                                            yUnit: "px",
                                            zUnit: "PX"
                                        }
                                    }, {
                                        id: "a-9-n-5",
                                        actionTypeId: "TRANSFORM_MOVE",
                                        config: {
                                            delay: 0,
                                            easing: "",
                                            duration: 500,
                                            target: {
                                                useEventTarget: "CHILDREN",
                                                selector: ".approach-card._3",
                                                selectorGuids: ["79312cd2-4ae3-9a3e-3d2c-ffdfd2816aef", "950cadf7-8c0b-d56d-5326-99e38856db66"]
                                            },
                                            yValue: 100,
                                            xUnit: "PX",
                                            yUnit: "px",
                                            zUnit: "PX"
                                        }
                                    }]
                                }, {
                                    keyframe: 25,
                                    actionItems: [{
                                        id: "a-9-n-6",
                                        actionTypeId: "TRANSFORM_MOVE",
                                        config: {
                                            delay: 0,
                                            easing: "",
                                            duration: 500,
                                            target: {
                                                useEventTarget: "CHILDREN",
                                                selector: ".approach-card._3",
                                                selectorGuids: ["79312cd2-4ae3-9a3e-3d2c-ffdfd2816aef", "950cadf7-8c0b-d56d-5326-99e38856db66"]
                                            },
                                            yValue: -40,
                                            xUnit: "PX",
                                            yUnit: "px",
                                            zUnit: "PX"
                                        }
                                    }, {
                                        id: "a-9-n-4",
                                        actionTypeId: "TRANSFORM_MOVE",
                                        config: {
                                            delay: 0,
                                            easing: "",
                                            duration: 500,
                                            target: {
                                                useEventTarget: "CHILDREN",
                                                selector: ".approach-card._2",
                                                selectorGuids: ["79312cd2-4ae3-9a3e-3d2c-ffdfd2816aef", "b9cec0ff-8242-8d0f-5899-375f9bc5af55"]
                                            },
                                            yValue: -80,
                                            xUnit: "PX",
                                            yUnit: "px",
                                            zUnit: "PX"
                                        }
                                    }, {
                                        id: "a-9-n-2",
                                        actionTypeId: "TRANSFORM_MOVE",
                                        config: {
                                            delay: 0,
                                            easing: "",
                                            duration: 500,
                                            target: {
                                                useEventTarget: "CHILDREN",
                                                selector: ".approach-card._1",
                                                selectorGuids: ["79312cd2-4ae3-9a3e-3d2c-ffdfd2816aef", "b0e4fe37-b239-3bcf-314c-b731b82d0ac4"]
                                            },
                                            yValue: -40,
                                            xUnit: "PX",
                                            yUnit: "px",
                                            zUnit: "PX"
                                        }
                                    }]
                                }, {
                                    keyframe: 65,
                                    actionItems: [{
                                        id: "a-9-n-9",
                                        actionTypeId: "TRANSFORM_MOVE",
                                        config: {
                                            delay: 0,
                                            easing: "",
                                            duration: 500,
                                            target: {
                                                useEventTarget: "CHILDREN",
                                                selector: ".approach-card._1",
                                                selectorGuids: ["79312cd2-4ae3-9a3e-3d2c-ffdfd2816aef", "b0e4fe37-b239-3bcf-314c-b731b82d0ac4"]
                                            },
                                            yValue: -100,
                                            xUnit: "PX",
                                            yUnit: "px",
                                            zUnit: "PX"
                                        }
                                    }, {
                                        id: "a-9-n-8",
                                        actionTypeId: "TRANSFORM_MOVE",
                                        config: {
                                            delay: 0,
                                            easing: "",
                                            duration: 500,
                                            target: {
                                                useEventTarget: "CHILDREN",
                                                selector: ".approach-card._3",
                                                selectorGuids: ["79312cd2-4ae3-9a3e-3d2c-ffdfd2816aef", "950cadf7-8c0b-d56d-5326-99e38856db66"]
                                            },
                                            yValue: -100,
                                            xUnit: "PX",
                                            yUnit: "px",
                                            zUnit: "PX"
                                        }
                                    }, {
                                        id: "a-9-n-7",
                                        actionTypeId: "TRANSFORM_MOVE",
                                        config: {
                                            delay: 0,
                                            easing: "",
                                            duration: 500,
                                            target: {
                                                useEventTarget: "CHILDREN",
                                                selector: ".approach-card._2",
                                                selectorGuids: ["79312cd2-4ae3-9a3e-3d2c-ffdfd2816aef", "b9cec0ff-8242-8d0f-5899-375f9bc5af55"]
                                            },
                                            yValue: 0,
                                            xUnit: "PX",
                                            yUnit: "px",
                                            zUnit: "PX"
                                        }
                                    }]
                                }]
                            }],
                            createdOn: 0x19c869f82e2
                        },
                        "a-11": {
                            id: "a-11",
                            title: "Accordion - Open",
                            actionItemGroups: [{
                                actionItems: [{
                                    id: "a-11-n",
                                    actionTypeId: "STYLE_SIZE",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 500,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".faq-item-content",
                                            selectorGuids: ["cb497ae0-ffb8-c885-ead7-79c7ae971884"]
                                        },
                                        heightValue: 0,
                                        widthUnit: "PX",
                                        heightUnit: "px",
                                        locked: !1
                                    }
                                }, {
                                    id: "a-11-n-6",
                                    actionTypeId: "GENERAL_DISPLAY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 0,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".faq-icon.close",
                                            selectorGuids: ["cb497ae0-ffb8-c885-ead7-79c7ae97188c", "4efa8d73-7203-1628-a81b-75ec05859999"]
                                        },
                                        value: "block"
                                    }
                                }, {
                                    id: "a-11-n-7",
                                    actionTypeId: "GENERAL_DISPLAY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 0,
                                        target: {
                                            selector: ".faq-icon.open",
                                            selectorGuids: ["cb497ae0-ffb8-c885-ead7-79c7ae97188c", "92f73bbf-274b-52d8-ade4-70a735154291"]
                                        },
                                        value: "none"
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    id: "a-11-n-3",
                                    actionTypeId: "STYLE_SIZE",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".faq-item-content",
                                            selectorGuids: ["cb497ae0-ffb8-c885-ead7-79c7ae971884"]
                                        },
                                        widthUnit: "PX",
                                        heightUnit: "AUTO",
                                        locked: !1
                                    }
                                }, {
                                    id: "a-11-n-4",
                                    actionTypeId: "GENERAL_DISPLAY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 0,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".faq-icon.open",
                                            selectorGuids: ["cb497ae0-ffb8-c885-ead7-79c7ae97188c", "92f73bbf-274b-52d8-ade4-70a735154291"]
                                        },
                                        value: "block"
                                    }
                                }, {
                                    id: "a-11-n-5",
                                    actionTypeId: "GENERAL_DISPLAY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 0,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".faq-icon.close",
                                            selectorGuids: ["cb497ae0-ffb8-c885-ead7-79c7ae97188c", "4efa8d73-7203-1628-a81b-75ec05859999"]
                                        },
                                        value: "none"
                                    }
                                }]
                            }],
                            useFirstGroupAsInitialState: !0,
                            createdOn: 0x199c88b2094
                        },
                        "a-12": {
                            id: "a-12",
                            title: "Accordion - Close",
                            actionItemGroups: [{
                                actionItems: [{
                                    id: "a-12-n",
                                    actionTypeId: "STYLE_SIZE",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 300,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".faq-item-content",
                                            selectorGuids: ["cb497ae0-ffb8-c885-ead7-79c7ae971884"]
                                        },
                                        heightValue: 0,
                                        widthUnit: "PX",
                                        heightUnit: "px",
                                        locked: !1
                                    }
                                }, {
                                    id: "a-12-n-3",
                                    actionTypeId: "GENERAL_DISPLAY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 0,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".faq-icon.close",
                                            selectorGuids: ["cb497ae0-ffb8-c885-ead7-79c7ae97188c", "4efa8d73-7203-1628-a81b-75ec05859999"]
                                        },
                                        value: "block"
                                    }
                                }, {
                                    id: "a-12-n-4",
                                    actionTypeId: "GENERAL_DISPLAY",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 0,
                                        target: {
                                            useEventTarget: "CHILDREN",
                                            selector: ".faq-icon.open",
                                            selectorGuids: ["cb497ae0-ffb8-c885-ead7-79c7ae97188c", "92f73bbf-274b-52d8-ade4-70a735154291"]
                                        },
                                        value: "none"
                                    }
                                }]
                            }],
                            useFirstGroupAsInitialState: !1,
                            createdOn: 0x199c88b2094
                        },
                        "a-13": {
                            id: "a-13",
                            title: "About Ticker",
                            actionItemGroups: [{
                                actionItems: [{
                                    id: "a-13-n",
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 0,
                                        target: {
                                            selector: ".about-banner-ticker-list",
                                            selectorGuids: ["7b360843-49ec-2315-f235-1419ef003820"]
                                        },
                                        xValue: 0,
                                        xUnit: "%",
                                        yUnit: "PX",
                                        zUnit: "PX"
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    id: "a-13-n-2",
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        easing: "",
                                        duration: 4e4,
                                        target: {
                                            selector: ".about-banner-ticker-list",
                                            selectorGuids: ["7b360843-49ec-2315-f235-1419ef003820"]
                                        },
                                        xValue: -100,
                                        xUnit: "%",
                                        yUnit: "PX",
                                        zUnit: "PX"
                                    }
                                }]
                            }],
                            useFirstGroupAsInitialState: !1,
                            createdOn: 0x19c8b2ae635
                        },
                        slideInBottom: {
                            id: "slideInBottom",
                            useFirstGroupAsInitialState: !0,
                            actionItemGroups: [{
                                actionItems: [{
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 0
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: 0,
                                        yValue: 100,
                                        xUnit: "PX",
                                        yUnit: "PX",
                                        zUnit: "PX"
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: 0,
                                        yValue: 0,
                                        xUnit: "PX",
                                        yUnit: "PX",
                                        zUnit: "PX"
                                    }
                                }, {
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 1
                                    }
                                }]
                            }]
                        },
                        growBigIn: {
                            id: "growBigIn",
                            useFirstGroupAsInitialState: !0,
                            actionItemGroups: [{
                                actionItems: [{
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 0
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "TRANSFORM_SCALE",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: 0,
                                        yValue: 0
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "TRANSFORM_SCALE",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: 1,
                                        yValue: 1
                                    }
                                }, {
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 1
                                    }
                                }]
                            }]
                        },
                        slideInLeft: {
                            id: "slideInLeft",
                            useFirstGroupAsInitialState: !0,
                            actionItemGroups: [{
                                actionItems: [{
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 0
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: -100,
                                        yValue: 0,
                                        xUnit: "PX",
                                        yUnit: "PX",
                                        zUnit: "PX"
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 1
                                    }
                                }, {
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: 0,
                                        yValue: 0,
                                        xUnit: "PX",
                                        yUnit: "PX",
                                        zUnit: "PX"
                                    }
                                }]
                            }]
                        },
                        slideInRight: {
                            id: "slideInRight",
                            useFirstGroupAsInitialState: !0,
                            actionItemGroups: [{
                                actionItems: [{
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 0
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: 100,
                                        yValue: 0,
                                        xUnit: "PX",
                                        yUnit: "PX",
                                        zUnit: "PX"
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 1
                                    }
                                }, {
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: 0,
                                        yValue: 0,
                                        xUnit: "PX",
                                        yUnit: "PX",
                                        zUnit: "PX"
                                    }
                                }]
                            }]
                        },
                        flipInLeft: {
                            id: "flipInLeft",
                            useFirstGroupAsInitialState: !0,
                            actionItemGroups: [{
                                actionItems: [{
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        duration: 0,
                                        delay: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 0
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "TRANSFORM_ROTATE",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: 0,
                                        yValue: -90,
                                        zValue: 0,
                                        xUnit: "DEG",
                                        yUnit: "DEG",
                                        zUnit: "DEG"
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "TRANSFORM_ROTATE",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: 0,
                                        yValue: 0,
                                        zValue: 0,
                                        xUnit: "DEG",
                                        yUnit: "DEG",
                                        zUnit: "DEG"
                                    }
                                }, {
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 1
                                    }
                                }]
                            }]
                        },
                        dropIn: {
                            id: "dropIn",
                            useFirstGroupAsInitialState: !0,
                            actionItemGroups: [{
                                actionItems: [{
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 0
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        yValue: -500,
                                        xUnit: "PX",
                                        yUnit: "PX",
                                        zUnit: "PX"
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "TRANSFORM_MOVE",
                                    config: {
                                        delay: 0,
                                        easing: "outBounce",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: 0,
                                        yValue: 0,
                                        zValue: 0,
                                        xUnit: "PX",
                                        yUnit: "PX",
                                        zUnit: "PX"
                                    }
                                }, {
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 1
                                    }
                                }]
                            }]
                        },
                        growIn: {
                            id: "growIn",
                            useFirstGroupAsInitialState: !0,
                            actionItemGroups: [{
                                actionItems: [{
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 0
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "TRANSFORM_SCALE",
                                    config: {
                                        delay: 0,
                                        duration: 0,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: .7500000000000001,
                                        yValue: .7500000000000001
                                    }
                                }]
                            }, {
                                actionItems: [{
                                    actionTypeId: "TRANSFORM_SCALE",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        xValue: 1,
                                        yValue: 1
                                    }
                                }, {
                                    actionTypeId: "STYLE_OPACITY",
                                    config: {
                                        delay: 0,
                                        easing: "outQuart",
                                        duration: 1e3,
                                        target: {
                                            id: "N/A",
                                            appliesTo: "TRIGGER_ELEMENT",
                                            useEventTarget: !0
                                        },
                                        value: 1
                                    }
                                }]
                            }]
                        }
                    },
                    site: {
                        mediaQueries: [{
                            key: "main",
                            min: 992,
                            max: 1e4
                        }, {
                            key: "medium",
                            min: 768,
                            max: 991
                        }, {
                            key: "small",
                            min: 480,
                            max: 767
                        }, {
                            key: "tiny",
                            min: 0,
                            max: 479
                        }]
                    }
                }), "complete" === document.readyState ? e() : document.addEventListener("readystatechange", () => {
                    "complete" === document.readyState && e()
                })
            },
            5921: function(e, t, a) {
                a(9461), a(7624), a(286), a(8334), a(2338), a(3695), a(322), a(941), a(5134), a(1655), a(9858), a(2444), a(9904), a(1724), a(9078), a(3973), a(4345), a(1430)
            }
        },
        t = {};

    function a(i) {
        var n = t[i];
        if (void 0 !== n) return n.exports;
        var o = t[i] = {
            id: i,
            loaded: !1,
            exports: {}
        };
        return e[i].call(o.exports, o, o.exports, a), o.loaded = !0, o.exports
    }
    a.m = e, a.d = (e, t) => {
        for (var i in t) a.o(t, i) && !a.o(e, i) && Object.defineProperty(e, i, {
            enumerable: !0,
            get: t[i]
        })
    }, a.hmd = e => ((e = Object.create(e)).children || (e.children = []), Object.defineProperty(e, "exports", {
        enumerable: !0,
        set: () => {
            throw Error("ES Modules may not assign module.exports or exports.*, Use ESM export syntax, instead: " + e.id)
        }
    }), e), a.g = (() => {
        if ("object" == typeof globalThis) return globalThis;
        try {
            return this || Function("return this")()
        } catch (e) {
            if ("object" == typeof window) return window
        }
    })(), a.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t), a.r = e => {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
            value: "Module"
        }), Object.defineProperty(e, "__esModule", {
            value: !0
        })
    }, a.nmd = e => (e.paths = [], e.children || (e.children = []), e), (() => {
        var e = [];
        a.O = (t, i, n, o) => {
            if (i) {
                o = o || 0;
                for (var d = e.length; d > 0 && e[d - 1][2] > o; d--) e[d] = e[d - 1];
                e[d] = [i, n, o];
                return
            }
            for (var c = 1 / 0, d = 0; d < e.length; d++) {
                for (var [i, n, o] = e[d], s = !0, l = 0; l < i.length; l++)(!1 & o || c >= o) && Object.keys(a.O).every(e => a.O[e](i[l])) ? i.splice(l--, 1) : (s = !1, o < c && (c = o));
                if (s) {
                    e.splice(d--, 1);
                    var r = n();
                    void 0 !== r && (t = r)
                }
            }
            return t
        }
    })(), a.rv = () => "1.3.9", (() => {
        var e = {
            998: 0
        };
        a.O.j = t => 0 === e[t];
        var t = (t, i) => {
                var n, o, [d, c, s] = i,
                    l = 0;
                if (d.some(t => 0 !== e[t])) {
                    for (n in c) a.o(c, n) && (a.m[n] = c[n]);
                    if (s) var r = s(a)
                }
                for (t && t(i); l < d.length; l++) o = d[l], a.o(e, o) && e[o] && e[o][0](), e[o] = 0;
                return a.O(r)
            },
            i = self.webpackChunk = self.webpackChunk || [];
        i.forEach(t.bind(null, 0)), i.push = t.bind(null, i.push.bind(i))
    })(), a.ruid = "bundler=rspack@1.3.9";
    var i = a.O(void 0, ["753", "27", "90"], function() {
        return a(5921)
    });
    i = a.O(i)
})();