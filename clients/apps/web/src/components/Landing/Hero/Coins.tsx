import { Center, Instance, Instances, useTexture } from '@react-three/drei'
import {
  GroupProps,
  MeshMatcapMaterialProps,
  useFrame,
} from '@react-three/fiber'
import { useTheme } from 'next-themes'
import { forwardRef, useRef } from 'react'
import * as THREE from 'three'
import { MeshMatcapMaterial } from 'three'
import material from './material.jpeg'
import lightMaterial from './material_light.png'

export const CustomMaterial = forwardRef<
  MeshMatcapMaterial,
  MeshMatcapMaterialProps
>((props, ref) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const texture = useTexture(material.src)
  const lightTexture = useTexture(lightMaterial.src)

  return (
    <meshMatcapMaterial
      {...props}
      ref={ref}
      matcap={isDark ? texture : lightTexture}
    ></meshMatcapMaterial>
  )
})

CustomMaterial.displayName = 'CustomMaterial'

const radius = 3
const count = 8

const Item = (props: GroupProps) => {
  const ref = useRef<THREE.Group>(null)

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.x += 0.01
      ref.current.rotation.y += 0.01
      ref.current.rotation.z += 0.01
    }
  })

  return (
    <group {...props}>
      <group ref={ref} rotation={[0, Math.PI / count, Math.PI / 2]}>
        <Instance />
      </group>
    </group>
  )
}

export const Coins = () => {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.z -= 0.01
    }
  })

  return (
    <Center>
      <group>
        <group ref={groupRef}>
          <Instances>
            <cylinderGeometry args={[1, 1, 0.1, 64]}></cylinderGeometry>
            <CustomMaterial></CustomMaterial>
            {Array.from({ length: 8 }).map((_, index) => {
              return (
                <Item
                  position={[
                    radius *
                      Math.cos((index * 2 * Math.PI) / count + Math.PI / 4),
                    radius *
                      Math.sin((index * 2 * Math.PI) / count + Math.PI / 4),
                    0,
                  ]}
                  rotation={[0, 0, (index * 2 * Math.PI) / count]}
                  key={index}
                ></Item>
              )
            })}
          </Instances>
        </group>
      </group>
    </Center>
  )
}
